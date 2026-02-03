// Download orchestration for fetch-based and blob-based downloads.
import { TTDB, UTIL, SPLASH } from '../state';
import { getStoredSetting } from '../utils/storage';

export const downloadFile = async (url, filename, buttonElement = null, attemptId = null, context = null) => {
	const logDownload = TTDB.LOG.ns('download');
	const attemptLabel = attemptId ? `#${attemptId}` : 'unknown';
	const hashString = (input) => {
		if (!input) return null;
		return input.split('').reduce((hash, char) => (hash * 33) ^ char.charCodeAt(0), 5381) >>> 0;
	};
	const videoKey = context && context.videoKey ? String(context.videoKey) : '';
	const keyHash = hashString(videoKey) || Date.now();
	const toastId = `download-${keyHash}${attemptId ? `-${attemptId}` : ''}`;

	filename = UTIL.sanitizeFilename(filename);
	let hasFallbacked = false;
	const isBlobUrl = typeof url === 'string' && url.startsWith('blob:');

	const getDisplayName = (value) => {
		if (!value) return 'video';
		const trimmed = value.trim();
		if (trimmed.length <= 42) return trimmed;
		return `${trimmed.slice(0, 28)}...${trimmed.slice(-10)}`;
	};

	const showToast = (message, options = {}) => {
		return SPLASH.message(message, {
			id: toastId,
			...options
		});
	};

	logDownload.info(`Attempt ${attemptLabel}: fetch start`, {
		url,
		filename,
		isBlobUrl,
		context
	});

	if (filename.length > 250) {
		filename = UTIL.truncateString(filename, 250);
	}

	showToast({
		title: 'Downloading',
		detail: getDisplayName(filename)
	}, {
		state: 0,
		sticky: true,
		spinner: true
	});

	const revertState = (buttonElement) => {
		if (buttonElement) {
			buttonElement.classList.remove('loading');
		}
	};

	// Blob URLs from the page often cannot be fetched from the content script.
	// Prefer a direct anchor download to avoid "Failed to fetch" errors.
	const attemptBlobDownload = (blobUrl) => {
		try {
			const anchor = document.createElement('a');
			anchor.href = blobUrl;
			anchor.download = filename || 'video.mp4';
			anchor.style.display = 'none';

			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();

			logDownload.info(`Attempt ${attemptLabel}: blob anchor triggered`);
			return true;
		} catch (error) {
			logDownload.info(`Attempt ${attemptLabel}: blob anchor failed`, error);
			return false;
		}
	};

	const fallback = async (url) => {
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
					state: 2
				});
			} else {
				showToast({
					title: 'Blob URL could not be opened',
					detail: 'Try another video.'
				}, {
					duration: 5000,
					state: 3
				});
			}

			revertState(buttonElement);
			hasFallbacked = true;
			return;
		}

		logDownload.warn(`Attempt ${attemptLabel}: fetch failed, opening in new tab`);

		showToast({
			title: 'Download blocked',
			detail: 'Opened the video in a new tab instead.'
		}, {
			duration: 4500,
			state: 2,
			hideMeta: true
		});

		const tabActive = await getStoredSetting('download-fallback-tab-focus');

		chrome.runtime.sendMessage(
			chrome.runtime.id, {
				task: 'windowOpen',
				url,
				active: tabActive === null ? true : tabActive
			}
		);

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
			hideMeta: !attempted
		});

		revertState(buttonElement);
		hasFallbacked = true;
		return;
	}

	let subFolder = await getStoredSetting('download-subfolder-path');
	if (!(typeof subFolder === 'string' || subFolder instanceof String)) {
		subFolder = '';
	}

	const fetchOptions = TTDB.headers;

	fetch(url, fetchOptions).then(async (t) => {
		let blobData = null;

		if (!UTIL.validateVideoRequest(t) || !t.body) {
			logDownload.warn(
				`Attempt ${attemptLabel}: probe failed (${t.headers.get('Content-Type') || ''} - ${t.status})`,
				t
			);
			return fallback(url);
		}

		logDownload.info(`Attempt ${attemptLabel}: probe valid`, t);

		const chromium = UTIL.isChromium();
		const responseBlob = blobData || await t.blob();
		const videoUrl = chromium ? URL.createObjectURL(responseBlob) : url;
		const response = await chrome.runtime.sendMessage({
			task: 'fileDownload',
			url: videoUrl,
			filename,
			subFolder
		});

		if (response.success) {
			logDownload.info(`Attempt ${attemptLabel}: downloaded`, { url });
			showToast({
				title: 'Download complete',
				detail: getDisplayName(filename)
			}, {
				duration: 3500,
				state: 1
			});
		} else {
			logDownload.warn(`Attempt ${attemptLabel}: download failed`, response);
			fallback(url);
		}

		revertState(buttonElement);

		if (chromium) {
			URL.revokeObjectURL(videoUrl);
		}
	}).catch((error) => {
		logDownload.error(`Attempt ${attemptLabel}: fetch error`, error);
		fallback(url);
	});
};

