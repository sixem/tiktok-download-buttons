// Download click handler.
//
// This module owns the click-time orchestration: stop TikTok's bubbling handlers,
// resolve the best URL, show click-time feedback, and dispatch the selected strategy.
// Button setup and hover-preview wiring live in `download-hook.ts` and
// `preview-button-interactivity.ts`.

import { TTDB, SPLASH } from '@/content/core/state';
import {
	clearButtonLoading,
	getRuntimeInfo,
	getStoredSetting,
	hashString,
	startButtonLoading
} from '@/content/utils';
import { DOWNLOAD_HOOK } from '@/content/download/constants';
import {
	downloadViaApi,
	downloadViaBlob,
	downloadViaDom,
	downloadViaIntercept
} from '@/content/download/strategies';
import { getVideoUrlFromButtonContext } from '@/content/extractors/video-url';
import {
	armPreviewCapture,
	getCachedPreviewUrl,
	waitForPreviewUrl
} from '@/content/download/state/preview-url-cache';
import {
	resolveDownloadAttempt,
	type DownloadAttemptAttrs,
	type DownloadAttemptSource
} from '@/content/download/flow/resolve-download-attempt';
import { nextAttemptIdForKey } from '@/content/download/flow/attempt-counter';
import type { ItemVideoData } from '@/types';

const getNameTemplate = async () => {
	const nameTemplate = await getStoredSetting('download-naming-template');

	if (!(typeof nameTemplate === 'string' || nameTemplate instanceof String) || nameTemplate.length < 1) {
		return false;
	}

	return nameTemplate.trim();
};

const readButtonDownloadAttrs = (button: HTMLElement, videoData: ItemVideoData): DownloadAttemptAttrs & { hasPageUrlAttribute: boolean } => {
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
		default:
			downloadViaDom(videoUrl, filename, button, attemptId, downloadContext);
			break;
	}
};

// Firefox API downloads are started from the extension context, so some signed
// TikTok video URLs need a page-like referer to be accepted reliably.
const getRefererCandidate = (pageUrl: string | null) => {
	if (pageUrl && /^https?:/i.test(pageUrl)) {
		return pageUrl;
	}

	const currentUrl = window.location.href;
	return /^https?:/i.test(currentUrl) ? currentUrl : null;
};

export const createDownloadClickHandler = (button: HTMLElement, videoData: ItemVideoData) => async (e: MouseEvent) => {
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
		const runtimeInfo = await getRuntimeInfo();

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
				chromium: runtimeInfo.isChromium
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
					chromium: runtimeInfo.isChromium
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
			user: videoData.user || null,
			pageUrl: getRefererCandidate(attrs.pageUrl || null)
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
