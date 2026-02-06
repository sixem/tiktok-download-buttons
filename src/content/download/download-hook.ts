// Download click wiring and helpers for resolving URLs and filenames.
import { TTDB, SPLASH, UTIL } from '../state';
import { DOM } from '../dom';
import { getStoredSetting } from '../utils/storage';
import { getWebApiData } from '../api/web-detail';
import { getItemDetailApiData } from '../api/item-detail';
import { getFileNameTemplate } from './filename';
import { downloadViaApi } from './strategies/api';
import { downloadViaDom } from './strategies/dom';
import { downloadViaIntercept } from './strategies/intercept';
import { downloadViaBlob } from './strategies/blob';
import { getVideoUrlFromButtonContext } from '../extractors/video-url';
import { armPreviewCapture, getCachedPreviewUrl, waitForPreviewUrl } from './preview-url-cache';
import { getRuntimeInfo } from '../utils/extension';

const getNameTemplate = async () => {
	let nameTemplate = await getStoredSetting('download-naming-template');

	if (!(typeof nameTemplate === 'string' || nameTemplate instanceof String) || nameTemplate.length < 1) {
		return false;
	}

	return nameTemplate.trim();
};

const getWebVideoUrl = (webData) => {
	const video = webData && webData.video ? webData.video : null;
	if (!video) return null;

	const candidates = [
		video.playAddr,
		video.downloadAddr,
		video.playAddrH264,
		video.playAddrBytevc1
	];

	for (const candidate of candidates) {
		if (!candidate) continue;
		if (typeof candidate === 'string') return candidate;
		if (Array.isArray(candidate) && candidate.length) return candidate[0];
		if (candidate.urlList && candidate.urlList.length) return candidate.urlList[0];
		if (candidate.url_list && candidate.url_list.length) return candidate.url_list[0];
	}

	return null;
};

// Resolve the best immediate URL from DOM context and button attributes.
const resolveVideoUrl = (button, attrUrl, pageUrl, logDownload, attemptLabel, attemptKey) => {
	const domVideoUrl = getVideoUrlFromButtonContext(button);
	const preferDomUrl = !!domVideoUrl && !domVideoUrl.startsWith('blob:');
	const isDomBlob = !!domVideoUrl && domVideoUrl.startsWith('blob:');

	let videoUrl = attrUrl;
	let source = attrUrl ? 'button-attr' : null;

	if (domVideoUrl) {
		const useDomUrl = !isDomBlob || !pageUrl;

		if (useDomUrl) {
			videoUrl = domVideoUrl;
			source = isDomBlob ? 'dom-blob' : 'dom';
		}

		logDownload.info(`Attempt ${attemptLabel}: DOM URL found`, {
			videoKey: attemptKey,
			url: domVideoUrl,
			source: isDomBlob ? 'dom-blob' : 'dom',
			used: useDomUrl
		});
	}

	return {
		videoUrl,
		source,
		domVideoUrl,
		preferDomUrl
	};
};

// Resolve URL and metadata from API sources when needed.
const resolveSource = async ({
	videoData,
	attrApiId,
	pageUrl,
	preferDomUrl,
	logDownload,
	attemptLabel,
	attemptKey
}) => {
	try {
		const webData = await getWebApiData({
			...videoData,
			...{
				videoApiId: attrApiId,
				pageUrl
			}
		});
		const webVideoUrl = getWebVideoUrl(webData);

		if (webVideoUrl) {
			const used = !preferDomUrl;
			logDownload.info(`Attempt ${attemptLabel}: web API URL`, {
				videoKey: attemptKey,
				used,
				url: webVideoUrl
			});
			logDownload.info(`Attempt ${attemptLabel}: web API data found`, {
				videoKey: attemptKey,
				response: webData
			});

			return {
				videoUrl: webVideoUrl,
				source: 'web-api',
				apiData: webData
			};
		}
	} catch (error) {
		logDownload.info(`Attempt ${attemptLabel}: web API failed, trying item detail API`, error);

		try {
			const itemDetailData = await getItemDetailApiData(attrApiId);
			const itemDetailUrl = getWebVideoUrl(itemDetailData);

			if (itemDetailUrl) {
				const used = !preferDomUrl;
				logDownload.info(`Attempt ${attemptLabel}: item detail API URL`, {
					videoKey: attemptKey,
					used,
					url: itemDetailUrl
				});
				logDownload.info(`Attempt ${attemptLabel}: item detail API data found`, {
					videoKey: attemptKey,
					response: itemDetailData
				});

				return {
					videoUrl: itemDetailUrl,
					source: 'item-detail-api',
					apiData: itemDetailData
				};
			}
		} catch (itemError) {
			logDownload.info(`Attempt ${attemptLabel}: item detail API failed`, itemError);
		}
	}

	return {
		videoUrl: null,
		source: null,
		apiData: null
	};
};

// Resolve final filename, falling back to the attribute name if no template applies.
const resolveFilename = (defaultFilename, nameTemplate, videoData, apiData) => {
	if (!nameTemplate) {
		return defaultFilename;
	}

	// Apply naming templates even when API data is missing.
	// Many placeholders (like `{uploader}` / `{id}`) can still be resolved from `videoData`.
	// If the template can't produce a usable result, fall back to the default filename.
	return getFileNameTemplate(videoData, apiData || {}, nameTemplate) || defaultFilename;
};

const hashString = (input) => {
	if (!input) return null;
	return String(input)
		.split('')
		.reduce((hash, char) => (hash * 33) ^ char.charCodeAt(0), 5381) >>> 0;
};

// Minimal click handler that orchestrates URL and filename resolution.
const onDownloadClick = (button, videoData) => async (e) => {
	e.preventDefault();

	if (button.classList.contains('loading')) {
		return false;
	}

	button.classList.add('loading');

	const attrFilename = button.getAttribute('filename') || null;
	const attrApiId = button.getAttribute('video-id') || null;
	const attrUrl = button.getAttribute('href') || null;
	const attrPageUrl = button.getAttribute('data-video-page-url') || null;
	const logDownload = TTDB.LOG.ns('download');
	const attemptKey = String(attrApiId || videoData.videoApiId || videoData.id || attrUrl || 'unknown');
	const attemptsByVideo = TTDB.stats.downloadAttemptsByVideo;
	const attemptId = (attemptsByVideo[attemptKey] = (attemptsByVideo[attemptKey] || 0) + 1);
	const attemptLabel = `#${attemptId}`;

	logDownload.info(`Attempt ${attemptLabel}: start`, {
		videoKey: attemptKey,
		filename: attrFilename,
		videoId: attrApiId,
		url: attrUrl
	});

	const nameTemplate = await getNameTemplate();
	const pageUrl = attrPageUrl || videoData.pageUrl || null;
	const runtimeInfo = await getRuntimeInfo();
	const runtimeFirefox = !!(runtimeInfo && typeof runtimeInfo === 'object' && (runtimeInfo as any).isFirefox);
	const firefox = runtimeFirefox || (typeof UTIL.isFirefox === 'function' ? UTIL.isFirefox() : false);
	const chromium = !firefox && UTIL.isChromium();

	if (pageUrl && !attrPageUrl) {
		button.setAttribute('data-video-page-url', pageUrl);
	}

	// Step 1: Attempt API resolution first. This is the most reliable path when TikTok returns data.
	const apiResolution = await resolveSource({
		videoData,
		attrApiId,
		pageUrl,
		preferDomUrl: false,
		logDownload,
		attemptLabel,
		attemptKey
	});

	// Step 2: Resolve a DOM video URL (only if it's not a blob:).
	const initialResolution = resolveVideoUrl(
		button,
		attrUrl,
		pageUrl,
		logDownload,
		attemptLabel,
		attemptKey
	);
	const domUrl = initialResolution.domVideoUrl || null;
	const domIsBlob = !!domUrl && domUrl.startsWith('blob:');
	const domIsHttp = !!domUrl && /^https?:/i.test(domUrl);

	const usageData = {
		videoUrl: null,
		filename: attrFilename
	};
	let resolvedSource = null;

	if (apiResolution.videoUrl) {
		usageData.videoUrl = apiResolution.videoUrl;
		resolvedSource = apiResolution.source;
	} else if (domIsHttp) {
		usageData.videoUrl = domUrl;
		resolvedSource = 'dom';
	}

	// Step 3: If the DOM gave us a blob: URL, try to use a cached preview URL captured from
	// ResourceTiming entries (hover previews). If missing, wait briefly for it to appear.
	if (!usageData.videoUrl && attrApiId) {
		const cached = getCachedPreviewUrl(attrApiId);
		if (cached) {
			logDownload.info(`Attempt ${attemptLabel}: preview URL cache hit`, {
				videoKey: attemptKey,
				videoId: attrApiId,
				url: cached
			});
			usageData.videoUrl = cached;
			resolvedSource = 'preview-cache';
		} else {
			logDownload.info(`Attempt ${attemptLabel}: preview URL cache miss`, {
				videoKey: attemptKey,
				videoId: attrApiId,
				waitMs: 1600
			});

			// Arm a short capture window and wait. This only works if TikTok actually requests
			// the preview URL (often on hover). We keep messaging explicit so it doesn't feel "stuck".
			armPreviewCapture(attrApiId, 'click', 1800);

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

			const waited = await waitForPreviewUrl(attrApiId, 1600);
			SPLASH.dismiss(prepToastId);

			if (waited) {
				logDownload.info(`Attempt ${attemptLabel}: preview URL captured`, {
					videoKey: attemptKey,
					videoId: attrApiId,
					url: waited
				});
				usageData.videoUrl = waited;
				resolvedSource = 'preview-cache';
			} else {
				logDownload.info(`Attempt ${attemptLabel}: preview URL not found in time`, {
					videoKey: attemptKey,
					videoId: attrApiId
				});
			}
		}
	}

	// Step 4: Final fallback. Blob download is Chromium-only (best-effort).
	if (!usageData.videoUrl && domIsBlob) {
		if (chromium) {
			usageData.videoUrl = domUrl;
			resolvedSource = 'dom-blob';
		} else {
			logDownload.warn(`Attempt ${attemptLabel}: blob URL blocked on Firefox`, {
				videoKey: attemptKey,
				url: domUrl
			});
			SPLASH.message({
				title: 'Download blocked on Firefox',
				detail: 'This video only exposed a blob URL. Hover the card to load a preview, then try again.'
			}, {
				duration: 6500,
				state: 3,
				hideMeta: true
			});
			button.classList.remove('loading');
			return;
		}
	}

	usageData.filename = resolveFilename(attrFilename, nameTemplate, videoData, apiResolution.apiData);

	if (!usageData.filename) {
		usageData.filename = attrFilename;
	}

	if (!usageData.videoUrl) {
		logDownload.warn(`Attempt ${attemptLabel}: no video URL resolved`, {
			videoKey: attemptKey,
			filename: usageData.filename,
			videoId: attrApiId
		});
		SPLASH.message({
			title: 'No downloadable video URL',
			detail: 'Try again, or try another post.'
		}, {
			duration: 6000,
			state: 3,
			hideMeta: true
		});
		button.classList.remove('loading');
		return;
	}

	logDownload.info(`Attempt ${attemptLabel}: download start`, {
		videoKey: attemptKey,
		url: usageData.videoUrl,
		filename: usageData.filename,
		source: resolvedSource
	});

	const downloadContext = {
		videoKey: attemptKey,
		source: resolvedSource,
		videoId: attrApiId,
		user: videoData.user || null
	};

	// Make the chosen download method explicit at the call-site.
	// This keeps the coordinator "dumb" and makes debugging a lot easier.
	switch (resolvedSource) {
		case 'web-api':
		case 'item-detail-api':
			downloadViaApi(usageData.videoUrl, usageData.filename, button, attemptId, downloadContext);
			break;
		case 'preview-cache':
			downloadViaIntercept(usageData.videoUrl, usageData.filename, button, attemptId, downloadContext);
			break;
		case 'dom-blob':
			downloadViaBlob(usageData.videoUrl, usageData.filename, button, attemptId, downloadContext);
			break;
		case 'dom':
		default:
			downloadViaDom(usageData.videoUrl, usageData.filename, button, attemptId, downloadContext);
			break;
	}
};

export const downloadHook = async (button, videoData) => {
	const videoIdentifier = videoData.id ? videoData.id : Date.now();
	let fileName = `${videoData.user ? videoData.user + ' - ' : ''}${videoIdentifier}`;

	DOM.setAttributes(button, {
		filename: `${fileName.trim()}.mp4`
	});

	if (videoData.videoApiId) {
		button.setAttribute('video-id', videoData.videoApiId);

		// Arm a preview-capture window when the user hovers the card. This is where TikTok
		// typically requests the signed MP4 URL we can later download.
		const container = button.closest('[is-downloadable]') || button.closest('article');
		if (container && !container.ttdbPreviewCaptureArmed) {
			container.addEventListener('pointerenter', () => {
				armPreviewCapture(videoData.videoApiId, 'hover', 1600);
			}, { passive: true });
			container.addEventListener('mouseenter', () => {
				armPreviewCapture(videoData.videoApiId, 'hover', 1600);
			}, { passive: true });
			container.ttdbPreviewCaptureArmed = true;
		}
	}

	if (!button.hasListener) {
		button.addEventListener('click', onDownloadClick(button, videoData));
		button.hasListener = true;
	}

	DOM.setStyle(button, {
		cursor: 'pointer',
		'pointer-events': 'auto'
	});

	return button;
};
