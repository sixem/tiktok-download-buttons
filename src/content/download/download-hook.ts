// Download click wiring and helpers for resolving URLs and filenames.
import { TTDB, SPLASH } from '../state';
import { DOM } from '../dom';
import { getStoredSetting } from '../utils/storage';
import { getWebApiData } from '../api/web-detail';
import { getItemDetailApiData } from '../api/item-detail';
import { getFileNameTemplate } from './filename';
import { downloadFile } from './download-file';
import { getVideoUrlFromButtonContext } from '../extractors/video-url';

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
	if (!nameTemplate || !apiData) {
		return defaultFilename;
	}

	return getFileNameTemplate(videoData, apiData, nameTemplate);
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

	if (pageUrl && !attrPageUrl) {
		button.setAttribute('data-video-page-url', pageUrl);
	}

	const initialResolution = resolveVideoUrl(
		button,
		attrUrl,
		pageUrl,
		logDownload,
		attemptLabel,
		attemptKey
	);
	const usageData = {
		videoUrl: initialResolution.videoUrl,
		filename: attrFilename
	};
	let resolvedSource = initialResolution.source;

	// Always attempt API resolution (web or item detail) even if we already have a DOM URL.
	// This helps replace blob:// sources with real HTTP URLs and pick up metadata for naming.
	const apiResolution = await resolveSource({
		videoData,
		attrApiId,
		pageUrl,
		preferDomUrl: initialResolution.preferDomUrl,
		logDownload,
		attemptLabel,
		attemptKey
	});

	if (apiResolution.videoUrl) {
		const domIsBlob = initialResolution.domVideoUrl ? initialResolution.domVideoUrl.startsWith('blob:') : false;
		const shouldPreferApi = domIsBlob || !initialResolution.videoUrl || !initialResolution.preferDomUrl;

		if (shouldPreferApi) {
			usageData.videoUrl = apiResolution.videoUrl;
			resolvedSource = apiResolution.source;
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
			detail: 'Try another post or refresh the page.'
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
	downloadFile(usageData.videoUrl, usageData.filename, button, attemptId, {
		videoKey: attemptKey,
		source: resolvedSource,
		videoId: attrApiId,
		user: videoData.user || null
	});
};

export const downloadHook = async (button, videoData) => {
	const videoIdentifier = videoData.id ? videoData.id : Date.now();
	let fileName = `${videoData.user ? videoData.user + ' - ' : ''}${videoIdentifier}`;

	DOM.setAttributes(button, {
		filename: `${fileName.trim()}.mp4`
	});

	if (videoData.videoApiId) {
		button.setAttribute('video-id', videoData.videoApiId);
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
