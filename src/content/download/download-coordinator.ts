// Download coordinator (content script).
//
// This file is intentionally "boring but explicit":
// - It coordinates UI (toasts), messaging to the service worker, and browser-specific behavior.
// - It does NOT decide which method to use (API / DOM / INTERCEPT / BLOB). That is done by
//   small strategy wrappers under `download/strategies/*`.
//
// Keeping these concerns separate makes it easier to debug "why did this download happen"
// without reading a 600+ line file.

import { TTDB, UTIL, SPLASH } from '../state';
import { getStoredSetting } from '../utils/storage';
import { getRuntimeInfo, sendRuntimeMessage } from '../utils/extension';
import { type DownloadMethodTag } from './download-method';

export type DownloadContext = {
	videoKey?: string;
	source?: string;
	videoId?: string;
	user?: string | null;
};

type CoordinatorArgs = {
	url: string;
	filename: string;
	buttonElement?: HTMLElement | null;
	attemptId?: string | number | null;
	context?: DownloadContext | null;
	methodTag: DownloadMethodTag | null;
};

// Track object URLs created for downloads so we can revoke them once the browser
// reports completion via the background service worker.
const globalState = globalThis as any;
const pendingDownloadObjectUrls = globalState.__ttdbPendingDownloadObjectUrls || new Map();
globalState.__ttdbPendingDownloadObjectUrls = pendingDownloadObjectUrls;

// Safety guard: downloads can outlive the page/tab (navigations, browser restarts, crashes).
// If we never receive a terminal `downloadStatus` message, we don't want to keep Map entries
// and captured closures around forever.
//
// Notes:
// - Chromium object-URL downloads already have a 2h revoke+delete safety timer. This mainly
//   protects Firefox sessions where `objectUrl` is `null`.
// - We prune opportunistically (on new downloads / on status messages) to avoid an always-on timer.
const MAX_PENDING_DOWNLOAD_SESSIONS = 400;
const PENDING_DOWNLOAD_SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const prunePendingDownloadSessions = (reason: string) => {
	const nowMs = Date.now();
	const sessions = pendingDownloadObjectUrls as Map<number, any>;

	const cleanup = (itemId: number, session: any) => {
		if (typeof session?.revokeTimerId === 'number') {
			clearTimeout(session.revokeTimerId);
		}

		if (typeof session?.objectUrl === 'string') {
			try {
				URL.revokeObjectURL(session.objectUrl);
			} catch (_) {
				// Best-effort cleanup.
			}
		}

		sessions.delete(itemId);
	};

	// 1) TTL pruning
	for (const [itemId, session] of sessions.entries()) {
		const startedAtMs = typeof session?.startedAtMs === 'number' ? session.startedAtMs : nowMs;
		if (nowMs - startedAtMs > PENDING_DOWNLOAD_SESSION_TTL_MS) {
			cleanup(itemId, session);
		}
	}

	// 2) Cap pruning (prefer evicting sessions without object URLs first, to avoid disrupting
	//    Chromium object-URL downloads that are still in-flight).
	if (sessions.size > MAX_PENDING_DOWNLOAD_SESSIONS) {
		const toEvictNoObjectUrl: Array<{ itemId: number; startedAtMs: number; session: any }> = [];
		const toEvictWithObjectUrl: Array<{ itemId: number; startedAtMs: number; session: any }> = [];

		for (const [itemId, session] of sessions.entries()) {
			const startedAtMs = typeof session?.startedAtMs === 'number' ? session.startedAtMs : 0;
			const bucket = typeof session?.objectUrl === 'string' ? toEvictWithObjectUrl : toEvictNoObjectUrl;
			bucket.push({ itemId, startedAtMs, session });
		}

		const sortByOldest = (a, b) => a.startedAtMs - b.startedAtMs;
		toEvictNoObjectUrl.sort(sortByOldest);
		toEvictWithObjectUrl.sort(sortByOldest);

		const evictionOrder = [...toEvictNoObjectUrl, ...toEvictWithObjectUrl];
		let idx = 0;
		while (sessions.size > MAX_PENDING_DOWNLOAD_SESSIONS && idx < evictionOrder.length) {
			const target = evictionOrder[idx++];
			cleanup(target.itemId, target.session);
		}
	}

	TTDB.LOG?.ns?.('download')?.debug?.('pruned pending download sessions', {
		reason,
		remaining: sessions.size
	});
};

// In Firefox, `downloads.download()` can start and then fail with `SERVER_FORBIDDEN` even when the
// signed URL was valid in a page fetch. When that happens, we retry from the page context by
// fetching the bytes and triggering a blob download.
const shouldRetryWithInPageFetch = (error: unknown) => {
	if (!error) return false;
	const text = String(error).toUpperCase();
	return text.includes('SERVER_FORBIDDEN') || text.includes('FORBIDDEN');
};

// When a download starts via one method but completes via another (typically `... -> blob`),
// surface that explicitly in the toast tag so debugging is easier.
const formatChainedMethodTag = (fromTag: string | null | undefined, toTag: string) => {
	if (!toTag) return fromTag || null;
	if (!fromTag) return toTag;
	if (fromTag === toTag) return toTag;
	return `${fromTag}->${toTag}`;
};

const attemptBlobAnchorDownload = (blobUrl: string, filename: string) => {
	try {
		const anchor = document.createElement('a');
		anchor.href = blobUrl;
		anchor.download = filename || 'video.mp4';
		anchor.style.display = 'none';

		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();

		return true;
	} catch (_) {
		return false;
	}
};

const attemptInPageFetchToBlobDownload = async ({
	url,
	filename,
	toastId,
	getDisplayName,
	toastTag
}: {
	url: string;
	filename: string;
	toastId: string;
	getDisplayName: (value: string) => string;
	toastTag: string | null;
}) => {
	const logDownload = TTDB.LOG?.ns?.('download');

	try {
		// Progress toast: keep it clean (no tag) while we're working.
		SPLASH.message({
			title: 'Retrying download',
			detail: getDisplayName(filename),
			meta: 'Fetching video data...'
		}, {
			id: toastId,
			state: 0,
			sticky: true,
			spinner: true,
			hideMeta: false,
			tag: null
		});

		const response = await fetch(url, TTDB.headers);
		// Be slightly more permissive than `UTIL.validateVideoRequest()` here:
		// some TikTok responses omit `Content-Length` (chunked transfer), but are still valid MP4 bytes.
		const contentType = response?.headers?.get?.('Content-Type') || '';
		const looksLikeVideo = contentType.includes('video/') || contentType.includes('application/octet-stream');
		if (!response?.ok || !response.body || !looksLikeVideo) {
			logDownload?.warn?.('in-page fetch retry probe failed', {
				status: response?.status,
				contentType: contentType || null
			});
			return false;
		}

		const blob = await response.blob();
		const blobUrl = URL.createObjectURL(blob);

		const started = attemptBlobAnchorDownload(blobUrl, filename);

		// We only need the blob URL long enough for the browser to grab it.
		setTimeout(() => {
			try {
				URL.revokeObjectURL(blobUrl);
			} catch (_) {
				// Best-effort cleanup.
			}
		}, 60_000);

		// Terminal toast: show the tag now.
		//
		// Note on subfolders:
		// The blob retry runs in the page context via an `<a download>` click.
		// Browsers intentionally do not allow websites to control download directories
		// (the `download` attribute is treated as a filename only), so this path
		// cannot honor the extension's "subfolder" setting.
		// Keep this short: toast meta is a single-line, ellipsis-truncated line in the UI.
		const subfolderNote = 'Saved to Downloads (no subfolder).';

		SPLASH.message({
			title: started ? 'Download triggered' : 'Download failed',
			detail: getDisplayName(filename),
			meta: started ? subfolderNote : 'Retry failed. Try again in a moment.'
		}, {
			id: toastId,
			state: started ? 1 : 3,
			sticky: false,
			spinner: false,
			duration: started ? 4800 : 6500,
			hideMeta: !started,
			tag: toastTag
		});

		logDownload?.info?.('in-page fetch retry result', { started });
		return started;
	} catch (error) {
		logDownload?.warn?.('in-page fetch retry error', error);
		SPLASH.message({
			title: 'Download failed',
			detail: getDisplayName(filename),
			meta: 'Retry failed. Try again in a moment.'
		}, {
			id: toastId,
			state: 3,
			sticky: false,
			spinner: false,
			duration: 6500,
			hideMeta: true,
			tag: toastTag
		});
		return false;
	}
};

const ensureDownloadStatusListener = () => {
	if (globalState.__ttdbDownloadStatusListenerInstalled) return;
	globalState.__ttdbDownloadStatusListenerInstalled = true;

	chrome.runtime.onMessage.addListener((data) => {
		prunePendingDownloadSessions('downloadStatus:message');

		if (!data || typeof data !== 'object') return;
		if (data.task !== 'downloadStatus') return;

		const itemId = (data as any).itemId;
		if (typeof itemId !== 'number') return;

		const session = pendingDownloadObjectUrls.get(itemId);
		if (!session) return;

		if (typeof session.revokeTimerId === 'number') {
			clearTimeout(session.revokeTimerId);
		}

		// Always revoke the object URL when we get a terminal signal.
		if (typeof session.objectUrl === 'string') {
			try {
				URL.revokeObjectURL(session.objectUrl);
			} catch (_) {
				// Ignore revoke errors; it is best-effort cleanup.
			}
		}

		const getDisplayName = session.getDisplayName;
		const isComplete = (data as any).state === 'complete';
		const isError = (data as any).state === 'error';

		// Retry path: Firefox sometimes starts the download and then gets blocked (SERVER_FORBIDDEN).
		// When that happens, we can still fetch the bytes in-page and trigger a blob download.
		if (isError && shouldRetryWithInPageFetch((data as any).error) && session.originalUrl && !session.hasRetried) {
			session.hasRetried = true;
			pendingDownloadObjectUrls.delete(itemId);

			// Retry uses a blob download, so the tag should reflect what actually happened.
			const chainedTag = formatChainedMethodTag(session.sourceTag || null, 'BLOB');
			void attemptInPageFetchToBlobDownload({
				url: String(session.originalUrl),
				filename: String(session.filename),
				toastId: String(session.toastId),
				getDisplayName,
				toastTag: chainedTag
			});

			return;
		}

		pendingDownloadObjectUrls.delete(itemId);
		prunePendingDownloadSessions('downloadStatus:terminal');

		const state = isComplete ? 1 : 3;
		const title = isComplete ? 'Download complete' : 'Download failed';

		// Terminal update: show the method tag now (API / DOM / INTERCEPT / BLOB).
		SPLASH.message({
			title,
			detail: getDisplayName(session.filename),
			meta: isComplete ? null : ((data as any).error ? String((data as any).error) : 'Try again in a moment.')
		}, {
			id: session.toastId,
			state,
			sticky: false,
			spinner: false,
			duration: isComplete ? 3500 : 6500,
			hideMeta: !isComplete,
			tag: session.sourceTag || null
		});

		TTDB.LOG?.ns('download')?.info?.(`Download status`, {
			itemId,
			state: (data as any).state,
			error: (data as any).error || null
		});
	});
};

export const downloadWithMethodTag = async ({
	url,
	filename,
	buttonElement = null,
	attemptId = null,
	context = null,
	methodTag
}: CoordinatorArgs) => {
	const logDownload = TTDB.LOG.ns('download');
	const attemptLabel = attemptId ? `#${attemptId}` : 'unknown';
	const hashString = (input: string | null) => {
		if (!input) return null;
		return input.split('').reduce((hash, char) => (hash * 33) ^ char.charCodeAt(0), 5381) >>> 0;
	};
	const videoKey = context && context.videoKey ? String(context.videoKey) : '';
	const keyHash = hashString(videoKey) || Date.now();
	const toastId = `download-${keyHash}${attemptId ? `-${attemptId}` : ''}`;

	filename = UTIL.sanitizeFilename(filename);
	let hasFallbacked = false;
	const isBlobUrl = typeof url === 'string' && url.startsWith('blob:');
	const runtimeInfo = await getRuntimeInfo();
	const runtimeFirefox = !!(runtimeInfo && typeof runtimeInfo === 'object' && (runtimeInfo as any).isFirefox);
	const firefox = runtimeFirefox || (typeof UTIL.isFirefox === 'function' ? UTIL.isFirefox() : false);
	const chromium = !firefox && UTIL.isChromium();
	const source = context && context.source ? String(context.source) : null;

	const getDisplayName = (value: string) => {
		if (!value) return 'video';
		const trimmed = value.trim();
		if (trimmed.length <= 42) return trimmed;
		return `${trimmed.slice(0, 28)}...${trimmed.slice(-10)}`;
	};

	ensureDownloadStatusListener();
	prunePendingDownloadSessions('download:start');

	const showToast = (message: any, options: any = {}) => {
		// Only show the method tag once we have a terminal toast state (complete/blocked/error).
		// While downloading we keep the toast clean to avoid feeling "busy" or "stuck".
		const isProgressToast = !!options.sticky || !!options.spinner;

		return SPLASH.message(message, {
			id: toastId,
			tag: isProgressToast ? null : (options.tag || methodTag || null),
			...options
		});
	};

	logDownload.info(`Attempt ${attemptLabel}: download begin`, {
		url,
		filename,
		isBlobUrl,
		context,
		methodTag: methodTag || null
	});

	if (filename.length > 250) {
		filename = UTIL.truncateString(filename, 250);
	}

	showToast({
		// Keep the "downloading" toast minimal; the final toast already shows the method tag.
		title: 'Downloading',
		detail: getDisplayName(filename)
	}, {
		state: 0,
		sticky: true,
		spinner: true
	});

	const revertState = (btn: HTMLElement | null) => {
		if (btn) {
			btn.classList.remove('loading');
		}
	};

	// Firefox-specific safety: blob: URLs are frequently not downloadable from a content script.
	// We treat them as a hard failure to avoid misleading "Download started" toasts.
	if (isBlobUrl && !chromium) {
		logDownload.warn(`Attempt ${attemptLabel}: blob URL blocked on Firefox`, {
			url,
			filename,
			context
		});

		showToast({
			title: 'Download blocked on Firefox',
			detail: 'This video only exposed a blob URL. Hover the card to load a preview, then try again.'
		}, {
			duration: 6500,
			state: 3,
			hideMeta: true,
			sticky: false,
			spinner: false
		});

		revertState(buttonElement);
		hasFallbacked = true;
		return;
	}

	// Blob URLs from the page often cannot be fetched from the content script.
	// Prefer a direct anchor download to avoid "Failed to fetch" errors.
	const attemptBlobDownload = (blobUrl: string) => {
		const started = attemptBlobAnchorDownload(blobUrl, filename || 'video.mp4');
		logDownload.info(`Attempt ${attemptLabel}: blob anchor ${started ? 'triggered' : 'failed'}`);
		return started;
	};

	// Last-resort "in-page" fallback:
	// If the service worker can't start a download (often due to missing headers / anti-bot),
	// we can still try to fetch the bytes from the page context and download a blob URL.
	//
	// Tradeoff:
	// - This can use a lot of memory for large videos.
	// - It cannot reliably place the file into a subfolder (browser-dependent).
	const attemptFetchToBlobDownload = async (httpUrl: string) => {
		if (!httpUrl || typeof httpUrl !== 'string') return false;
		if (!/^https?:/i.test(httpUrl)) return false;

		const chainedTag = formatChainedMethodTag(methodTag || null, 'BLOB');

		try {
			showToast({
				title: 'Retrying download',
				detail: getDisplayName(filename),
				meta: 'Fetching video data...'
			}, {
				state: 0,
				sticky: true,
				spinner: true,
				hideMeta: false
			});

			const response = await fetch(httpUrl, TTDB.headers);
			if (!UTIL.validateVideoRequest(response) || !response.body) {
				logDownload.warn(`Attempt ${attemptLabel}: in-page fetch fallback probe failed`, response);
				showToast({
					title: 'Download blocked',
					detail: getDisplayName(filename),
					meta: 'Fetch failed. Try again in a moment.'
				}, {
					duration: 6500,
					state: 3,
					hideMeta: true,
					sticky: false,
					spinner: false
				});
				return false;
			}

			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);

			const started = attemptBlobDownload(blobUrl);
			// This blob URL is only needed to kick off the download; revoke quickly.
			// (Browsers keep an internal ref once download starts.)
			setTimeout(() => {
				try {
					URL.revokeObjectURL(blobUrl);
				} catch (_) {
					// Best-effort cleanup.
				}
			}, 60_000);

			logDownload.info(`Attempt ${attemptLabel}: in-page fetch fallback ${started ? 'triggered' : 'failed'}`);

			if (started) {
				showToast({
					title: 'Download triggered',
					detail: getDisplayName(filename),
					meta: 'Saved to Downloads (no subfolder).'
				}, {
					duration: 4800,
					state: 1,
					hideMeta: false,
					sticky: false,
					spinner: false,
					// This path used a blob download, so override the tag to reflect reality.
					// (The URL source may still be API/DOM/INTERCEPT.)
					tag: chainedTag
				});
			} else {
				showToast({
					title: 'Download blocked',
					detail: getDisplayName(filename),
					meta: 'Could not trigger the browser download.'
				}, {
					duration: 6500,
					state: 3,
					hideMeta: true,
					sticky: false,
					spinner: false,
					tag: chainedTag
				});
			}

			return started;
		} catch (error) {
			logDownload.warn(`Attempt ${attemptLabel}: in-page fetch fallback error`, error);
			showToast({
				title: 'Download blocked',
				detail: getDisplayName(filename),
				meta: 'Fetch error. Try again in a moment.'
			}, {
				duration: 6500,
				state: 3,
				hideMeta: true,
				sticky: false,
				spinner: false
			});
			return false;
		}
	};

	const fallback = async () => {
		if (hasFallbacked) return;

		logDownload.info(`Attempt ${attemptLabel}: fallback`, {
			url,
			isBlobUrl,
			context
		});

		if (isBlobUrl) {
			const attempted = attemptBlobDownload(url);

			if (attempted) {
				showToast({
					title: 'Blob download attempted',
					detail: 'If it did not start, try another video.'
				}, {
					duration: 5000,
					state: 2,
					tag: 'BLOB'
				});
			} else {
				showToast({
					title: 'Blob URL could not be opened',
					detail: 'Try another video.'
				}, {
					duration: 5000,
					state: 3,
					tag: 'BLOB'
				});
			}

			revertState(buttonElement);
			hasFallbacked = true;
			return;
		}

		// We never auto-open a tab as a "fallback" because:
		// - It feels disruptive (sudden tab switches / popups).
		// - Signed CDN URLs frequently return "Access Denied" outside the normal page context.
		//
		// Instead we surface a clear error toast and rely on other in-extension fallbacks.
		logDownload.warn(`Attempt ${attemptLabel}: download blocked (no tab fallback)`);

		showToast({
			title: 'Download blocked',
			detail: 'TikTok blocked this download attempt. Try again in a moment.'
		}, {
			duration: 6500,
			state: 3,
			hideMeta: true,
			sticky: false,
			spinner: false
		});

		revertState(buttonElement);
		hasFallbacked = true;
	};

	if (isBlobUrl) {
		const attempted = attemptBlobDownload(url);

		showToast({
			title: attempted ? 'Download started' : 'Blob download blocked',
			detail: attempted ? getDisplayName(filename) : 'Try another video.'
		}, {
			duration: attempted ? 3500 : 5000,
			state: attempted ? 1 : 3,
			hideMeta: !attempted,
			tag: 'BLOB'
		});

		revertState(buttonElement);
		hasFallbacked = true;
		return;
	}

	let subFolder = await getStoredSetting('download-subfolder-path');
	if (!(typeof subFolder === 'string' || subFolder instanceof String)) {
		subFolder = '';
	}

	// Firefox path: attempt a direct download and return immediately.
	//
	// Important:
	// - `downloads.download()` runs in the extension service worker.
	// - Avoiding an extra "probe fetch" reduces rate limits and removes a whole
	//   class of timing failures.
	if (!chromium) {
		let response: any = null;
		try {
			response = await sendRuntimeMessage({
				task: 'fileDownload',
				url,
				filename,
				subFolder
			});
		} catch (error) {
			logDownload.warn(`Attempt ${attemptLabel}: download request failed`, error);
			revertState(buttonElement);
			return fallback();
		}

		if (response && response.success && typeof response.itemId === 'number') {
			pendingDownloadObjectUrls.set(response.itemId, {
				objectUrl: null,
				startedAtMs: Date.now(),
				toastId,
				filename,
				sourceTag: methodTag,
				originalUrl: url,
				hasRetried: false,
				getDisplayName,
				revokeTimerId: null
			});

			logDownload.info(`Attempt ${attemptLabel}: download started`, {
				url,
				itemId: response.itemId
			});

			SPLASH.message({
				title: 'Download started',
				detail: getDisplayName(filename),
				meta: 'Finishing in browser...'
			}, {
				id: toastId,
				state: 0,
				sticky: false,
				spinner: false,
				duration: 7000,
				hideMeta: false,
				tag: null
			});

			revertState(buttonElement);
			return;
		}

		logDownload.warn(`Attempt ${attemptLabel}: download failed`, response);

		// If TikTok blocks the "raw URL" download, try an in-page fetch->blob fallback.
		const inPageStarted = await attemptFetchToBlobDownload(url);
		if (inPageStarted) {
			revertState(buttonElement);
			hasFallbacked = true;
			return;
		}

		revertState(buttonElement);
		return fallback();
	}

	const fetchOptions = TTDB.headers;

	fetch(url, fetchOptions).then(async (t) => {
		let blobData = null;

		if (!UTIL.validateVideoRequest(t) || !t.body) {
			logDownload.warn(
				`Attempt ${attemptLabel}: probe failed (${t.headers.get('Content-Type') || ''} - ${t.status})`,
				t
			);
			return fallback();
		}

		logDownload.info(`Attempt ${attemptLabel}: probe valid`, t);

		const responseBlob = blobData || await t.blob();

		// Chromium path: use an object URL to avoid a second request from the service worker.
		const videoUrl = URL.createObjectURL(responseBlob);
		let response: any = null;
		try {
			response = await sendRuntimeMessage({
				task: 'fileDownload',
				url: videoUrl,
				filename,
				subFolder
			});
		} catch (error) {
			logDownload.warn(`Attempt ${attemptLabel}: download request failed`, error);
			return fallback();
		}

		if (response && response.success && typeof response.itemId === 'number') {
			// Store for later cleanup + toast update when the service worker reports completion.
			pendingDownloadObjectUrls.set(response.itemId, {
				objectUrl: videoUrl,
				startedAtMs: Date.now(),
				toastId,
				filename,
				sourceTag: methodTag,
				originalUrl: url,
				hasRetried: false,
				getDisplayName,
				// Safety net: if we never hear back from the service worker (tab navigated, etc),
				// don't keep object URLs alive forever.
				revokeTimerId: setTimeout(() => {
					const stillPending = pendingDownloadObjectUrls.get(response.itemId);
					if (!stillPending) return;

					pendingDownloadObjectUrls.delete(response.itemId);
					if (typeof stillPending.objectUrl === 'string') {
						try {
							URL.revokeObjectURL(stillPending.objectUrl);
						} catch (_) {
							// Ignore revoke errors; best-effort cleanup.
						}
					}
				}, 2 * 60 * 60 * 1000) // 2 hours
			});

			logDownload.info(`Attempt ${attemptLabel}: download started`, {
				url,
				itemId: response.itemId
			});

			// Update the toast so it doesn't feel "stuck": downloading now happens in the browser.
			// We'll post a final complete/failed toast later via the status listener.
			SPLASH.message({
				title: 'Download started',
				detail: getDisplayName(filename),
				meta: 'Finishing in browser...'
			}, {
				id: toastId,
				state: 0,
				sticky: false,
				spinner: false,
				duration: 7000,
				hideMeta: false,
				tag: null
			});
		} else {
			// If the service worker responded without an itemId, treat it as a failure.
			logDownload.warn(`Attempt ${attemptLabel}: download failed`, response);

			try {
				URL.revokeObjectURL(videoUrl);
			} catch (_) {
				// Ignore revoke errors; best-effort cleanup.
			}
			fallback();
		}

		revertState(buttonElement);
	}).catch((error) => {
		logDownload.error(`Attempt ${attemptLabel}: fetch error`, error);
		fallback();
	});
};
