// Download click wiring and UI-only orchestration.
//
// Core resolution decisions live in `resolve-download-attempt.ts` so this module can
// stay focused on event handling, preview UX, and strategy dispatch wiring.
import { TTDB, SPLASH } from '@/content/state';
import { DOM } from '@/content/dom';
import {
	clearButtonLoading,
	getRuntimeInfo,
	getStoredSetting,
	hashString,
	startButtonLoading
} from '@/content/utils';
import { DOWNLOAD_HOOK } from './constants';
import {
	downloadViaApi,
	downloadViaBlob,
	downloadViaDom,
	downloadViaIntercept
} from './strategies';
import { getVideoUrlFromButtonContext } from '@/content/extractors/video-url';
import { armPreviewCapture, getCachedPreviewUrl, waitForPreviewUrl } from './preview-url-cache';
import {
	resolveDownloadAttempt,
	type DownloadAttemptAttrs,
	type DownloadAttemptSource
} from './resolve-download-attempt';

const getNameTemplate = async () => {
	const nameTemplate = await getStoredSetting('download-naming-template');

	if (!(typeof nameTemplate === 'string' || nameTemplate instanceof String) || nameTemplate.length < 1) {
		return false;
	}

	return nameTemplate.trim();
};

const readButtonDownloadAttrs = (button, videoData): DownloadAttemptAttrs & { hasPageUrlAttribute: boolean } => {
	const filename = button.getAttribute('filename') || null;
	const apiId = button.getAttribute('video-id') || null;
	const url = button.getAttribute('href') || null;
	const attrPageUrl = button.getAttribute('data-video-page-url') || null;

	return {
		filename,
		apiId,
		url,
		pageUrl: attrPageUrl || videoData.pageUrl || null,
		hasPageUrlAttribute: !!attrPageUrl
	};
};

const nextAttemptIdForKey = (attemptKey: string) => {
	const attemptsByVideo = TTDB.stats.downloadAttemptsByVideo;

	// Safety guard: a long TikTok session can involve thousands of unique posts.
	// Keep the attempt counter map bounded so we don't retain an unbounded set of keys.
	TTDB.stats.downloadAttemptOrder = TTDB.stats.downloadAttemptOrder || [];
	const attemptOrder: string[] = TTDB.stats.downloadAttemptOrder;
	const isFirstAttemptForVideo = !Object.prototype.hasOwnProperty.call(attemptsByVideo, attemptKey);
	if (isFirstAttemptForVideo) {
		attemptOrder.push(attemptKey);
	}

	while (attemptOrder.length > DOWNLOAD_HOOK.maxAttemptKeys) {
		const oldest = attemptOrder.shift();
		if (!oldest) continue;
		delete attemptsByVideo[oldest];
	}

	return (attemptsByVideo[attemptKey] = (attemptsByVideo[attemptKey] || 0) + 1);
};

const resolveRuntimeEnv = async () => {
	const runtimeInfo = await getRuntimeInfo();

	return {
		firefox: runtimeInfo.isFirefox,
		chromium: runtimeInfo.isChromium
	};
};

const waitForPreviewUrlFromClick = async ({
	attemptKey,
	attemptId,
	apiId,
	logDownload,
	attemptLabel
}: {
	attemptKey: string;
	attemptId: number;
	apiId: string;
	logDownload: any;
	attemptLabel: string;
}) => {
	logDownload.info(`Attempt ${attemptLabel}: preview URL cache miss`, {
		videoKey: attemptKey,
		videoId: apiId,
		waitMs: DOWNLOAD_HOOK.previewWaitMs
	});

	// Arm a short capture window and wait. This only works if TikTok actually requests
	// the preview URL (often on hover). We keep messaging explicit so it doesn't feel "stuck".
	armPreviewCapture(apiId, 'click', DOWNLOAD_HOOK.previewCaptureWindowMs);

	const toastKeyHash = hashString(attemptKey) || Date.now();
	const prepToastId = `download-prepare-${toastKeyHash}-${attemptId}`;

	SPLASH.message({
		title: 'Preparing download',
		detail: 'Hover the video to load a preview, then wait a moment...'
	}, {
		id: prepToastId,
		state: 0,
		sticky: true,
		spinner: true,
		hideMeta: true
	});

	const waited = await waitForPreviewUrl(apiId, DOWNLOAD_HOOK.previewWaitMs);
	SPLASH.dismiss(prepToastId);

	if (waited) {
		logDownload.info(`Attempt ${attemptLabel}: preview URL captured`, {
			videoKey: attemptKey,
			videoId: apiId,
			url: waited
		});
	} else {
		logDownload.info(`Attempt ${attemptLabel}: preview URL not found in time`, {
			videoKey: attemptKey,
			videoId: apiId
		});
	}

	return waited;
};

const dispatchDownloadStrategy = ({
	source,
	videoUrl,
	filename,
	button,
	attemptId,
	downloadContext
}: {
	source: DownloadAttemptSource;
	videoUrl: string;
	filename: string;
	button: HTMLElement;
	attemptId: number;
	downloadContext: any;
}) => {
	// Make the chosen download method explicit at the call-site.
	// This keeps the coordinator "dumb" and makes debugging a lot easier.
	switch (source) {
		case 'web-api':
		case 'item-detail-api':
			downloadViaApi(videoUrl, filename, button, attemptId, downloadContext);
			break;
		case 'preview-cache':
			downloadViaIntercept(videoUrl, filename, button, attemptId, downloadContext);
			break;
		case 'dom-blob':
			downloadViaBlob(videoUrl, filename, button, attemptId, downloadContext);
			break;
		case 'dom':
		default:
			downloadViaDom(videoUrl, filename, button, attemptId, downloadContext);
			break;
	}
};

// Minimal click handler that only orchestrates UI/events and delegates resolution.
const onDownloadClick = (button, videoData) => async (e) => {
	// Browser mode can reuse a single button across mode switches.
	// If this button is currently acting as slideshow launcher, let that handler run.
	if (button.getAttribute('data-ttdb-content-type') === 'slideshow') {
		return true;
	}

	// TikTok attaches various click handlers high up in the tree (and sometimes on the cards
	// themselves). If our overlay button bubbles up, it can toggle playback or trigger navigation.
	// We treat the TTDB button as a self-contained control.
	e.preventDefault();
	e.stopPropagation();
	e.stopImmediatePropagation?.();

	if (button.classList.contains('loading')) {
		return false;
	}

	startButtonLoading(button);

	const attrs = readButtonDownloadAttrs(button, videoData);
	const logDownload = TTDB.LOG.ns('download');
	const attemptKey = String(attrs.apiId || videoData.videoApiId || videoData.id || attrs.url || 'unknown');
	const attemptId = nextAttemptIdForKey(attemptKey);
	const attemptLabel = `#${attemptId}`;

	logDownload.info(`Attempt ${attemptLabel}: start`, {
		videoKey: attemptKey,
		filename: attrs.filename,
		videoId: attrs.apiId,
		url: attrs.url
	});

	try {
		const nameTemplate = await getNameTemplate();
		const runtime = await resolveRuntimeEnv();

		if (attrs.pageUrl && !attrs.hasPageUrlAttribute) {
			button.setAttribute('data-video-page-url', attrs.pageUrl);
		}

		const domVideoUrl = getVideoUrlFromButtonContext(button);
		if (domVideoUrl) {
			logDownload.info(`Attempt ${attemptLabel}: DOM URL found`, {
				videoKey: attemptKey,
				url: domVideoUrl,
				source: domVideoUrl.startsWith('blob:') ? 'dom-blob' : 'dom'
			});
		}

		const previewCachedUrl = attrs.apiId ? getCachedPreviewUrl(attrs.apiId) : null;
		if (previewCachedUrl && attrs.apiId) {
			logDownload.info(`Attempt ${attemptLabel}: preview URL cache hit`, {
				videoKey: attemptKey,
				videoId: attrs.apiId,
				url: previewCachedUrl
			});
		}

		let resolution = await resolveDownloadAttempt({
			videoData,
			attrs,
			env: {
				chromium: runtime.chromium
			},
			nameTemplate,
			candidates: {
				domVideoUrl,
				previewCachedUrl,
				previewWaitedUrl: null,
				previewWaitAttempted: false
			}
		});

		if (resolution.needsPreviewWait && attrs.apiId) {
			const waitedPreviewUrl = await waitForPreviewUrlFromClick({
				attemptKey,
				attemptId,
				apiId: attrs.apiId,
				logDownload,
				attemptLabel
			});

			resolution = await resolveDownloadAttempt({
				videoData,
				attrs,
				env: {
					chromium: runtime.chromium
				},
				nameTemplate,
				candidates: {
					domVideoUrl,
					previewCachedUrl: getCachedPreviewUrl(attrs.apiId),
					previewWaitedUrl: waitedPreviewUrl,
					previewWaitAttempted: true
				}
			});
		}

		if (resolution.blockedReason === 'firefox-blob') {
			logDownload.warn(`Attempt ${attemptLabel}: blob URL blocked on Firefox`, {
				videoKey: attemptKey,
				url: domVideoUrl
			});
			SPLASH.message({
				title: 'Download blocked on Firefox',
				detail: 'This video only exposed a blob URL. Hover the card to load a preview, then try again.'
			}, {
				duration: 6500,
				state: 3,
				hideMeta: true
			});
			return;
		}

		if (!resolution.videoUrl) {
			logDownload.warn(`Attempt ${attemptLabel}: no video URL resolved`, {
				videoKey: attemptKey,
				filename: resolution.filename,
				videoId: attrs.apiId
			});
			SPLASH.message({
				title: 'No downloadable video URL',
				detail: 'Try again, or try another post.'
			}, {
				duration: 6000,
				state: 3,
				hideMeta: true
			});
			return;
		}

		const resolvedFilename = resolution.filename || attrs.filename;
		if (!resolvedFilename) {
			logDownload.warn(`Attempt ${attemptLabel}: missing filename after resolution`, {
				videoKey: attemptKey,
				videoId: attrs.apiId
			});
			return;
		}

		logDownload.info(`Attempt ${attemptLabel}: download start`, {
			videoKey: attemptKey,
			url: resolution.videoUrl,
			filename: resolvedFilename,
			source: resolution.source
		});

		const downloadContext = {
			videoKey: attemptKey,
			source: resolution.source,
			videoId: attrs.apiId,
			user: videoData.user || null
		};

		dispatchDownloadStrategy({
			source: resolution.source,
			videoUrl: resolution.videoUrl,
			filename: resolvedFilename,
			button,
			attemptId,
			downloadContext
		});
	} finally {
		clearButtonLoading(button);
	}
};

export const downloadHook = async (button, videoData) => {
	const videoIdentifier = videoData.id ? videoData.id : Date.now();
	const fileName = `${videoData.user ? videoData.user + ' - ' : ''}${videoIdentifier}`;

	DOM.setAttributes(button, {
		filename: `${fileName.trim()}.mp4`
	});

	if (videoData.videoApiId) {
		button.setAttribute('video-id', videoData.videoApiId);

		const isGridButton = button.classList.contains('ttdb__button_grid');

		// Arm a preview-capture window when the user hovers the card. This is where TikTok
		// typically requests the signed MP4 URL we can later download.
		const container = button.closest('[is-downloadable]') || button.closest('article');
		if (container && !container.ttdbPreviewCaptureArmed) {
			// Newer grid-like cards (e.g. "You may like") do not have `[mode]` and frequently
			// rely on hover previews to expose a usable signed MP4 URL.
			//
			// For these cards, we keep the overlay non-interactive until the preview URL is
			// observed in ResourceTiming. This makes the UX match the other grid items: hover
			// first (to load a preview), then click to download.
			const isNoModeCard = isGridButton && !container.querySelector('[mode]');

			const setInteractive = (interactive: boolean) => {
				DOM.setStyle(button, {
					cursor: interactive ? 'pointer' : 'not-allowed',
					'pointer-events': interactive ? 'auto' : 'none'
				});
			};

			const ensureInteractiveOncePreviewIsCached = () => {
				if (!isNoModeCard) return;
				if (button.ttdbPreviewReady) return;
				if (button.ttdbPreviewReadyPromise) return;

				const cached = getCachedPreviewUrl(videoData.videoApiId);
				if (cached) {
					button.ttdbPreviewReady = true;
					setInteractive(true);
					return;
				}

				button.ttdbPreviewReadyPromise = waitForPreviewUrl(videoData.videoApiId, DOWNLOAD_HOOK.previewWaitMs)
					.then((url) => {
						if (!url) return;
						button.ttdbPreviewReady = true;
						setInteractive(true);
					})
					.finally(() => {
						button.ttdbPreviewReadyPromise = null;
					});
			};

			if (isNoModeCard) {
				// Start in "hover-through" mode so we don't stop the preview playback by accident.
				button.ttdbInteractivityManaged = true;
				setInteractive(false);
				// If we already captured a preview URL earlier (e.g. you hovered before the button
				// was injected), enable immediately.
				ensureInteractiveOncePreviewIsCached();
			}

			container.addEventListener('pointerenter', () => {
				armPreviewCapture(videoData.videoApiId, 'hover', DOWNLOAD_HOOK.previewWaitMs);
				ensureInteractiveOncePreviewIsCached();
			}, { passive: true });

			container.addEventListener('mouseenter', () => {
				armPreviewCapture(videoData.videoApiId, 'hover', DOWNLOAD_HOOK.previewWaitMs);
				ensureInteractiveOncePreviewIsCached();
			}, { passive: true });

			container.ttdbPreviewCaptureArmed = true;
		}
	}

	if (!button.hasListener) {
		button.addEventListener('click', onDownloadClick(button, videoData));
		button.hasListener = true;
	}

	// Default behavior: buttons are interactive once wired.
	// Some grid cards override this temporarily via the hover-preview logic above.
	if (!button.ttdbInteractivityManaged) {
		DOM.setStyle(button, {
			cursor: 'pointer',
			'pointer-events': 'auto'
		});
	}

	return button;
};
