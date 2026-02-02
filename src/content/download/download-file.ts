import { TTDB, UTIL, SPLASH } from '../state';
import { getStoredSetting } from '../utils/storage';

export const downloadFile = async (url, filename, buttonElement = null, attemptId = null, context = null) => {
	const logDownload = TTDB.LOG.ns('download');
	const attemptLabel = attemptId ? `#${attemptId}` : 'unknown';

	filename = UTIL.sanitizeFilename(filename);
	let hasFallbacked = false;
	const isBlobUrl = typeof url === 'string' && url.startsWith('blob:');

	logDownload.info(`Attempt ${attemptLabel}: fetch start`, {
		url,
		filename,
		isBlobUrl,
		context
	});

	if (filename.length > 250) {
		filename = UTIL.truncateString(filename, 250);
	}

	const revertState = (buttonElement) => {
		if (buttonElement) {
			buttonElement.classList.remove('loading');
		}
	};

	const fallback = async (url) => {
		if (hasFallbacked) return;

		logDownload.warn(`Attempt ${attemptLabel}: fallback`, {
			url,
			isBlobUrl,
			context
		});

		if (isBlobUrl) {
			let attempted = false;

			try {
				const anchor = document.createElement('a');
				anchor.href = url;
				anchor.download = filename || 'video.mp4';
				anchor.style.display = 'none';

				document.body.appendChild(anchor);
				anchor.click();
				anchor.remove();

				attempted = true;
			} catch (error) {
				logDownload.error(`Attempt ${attemptLabel}: blob anchor failed`, error);
			}

			if (attempted) {
				logDownload.warn(`Attempt ${attemptLabel}: blob anchor attempted`);
				SPLASH.message('Attempted blob download', {
					duration: 3000, state: 1
				});
			} else {
				logDownload.warn(`Attempt ${attemptLabel}: blob URL cannot be opened`);
				SPLASH.message('Blob URL could not be opened. Try another video.', {
					duration: 4000, state: 3
				});
			}

			revertState(buttonElement);
			hasFallbacked = true;
			return;
		}

		logDownload.warn(`Attempt ${attemptLabel}: fetch failed, opening in new tab`);

		SPLASH.message(
			'Opened video in new tab (fetch was not allowed)', {
				duration: 3500, state: 2
			}
		);

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

	let subFolder = await getStoredSetting('download-subfolder-path');
	if (!(typeof subFolder === 'string' || subFolder instanceof String)) {
		subFolder = '';
	}

	fetch(url, TTDB.headers).then(async (t) => {
		let blobData = null;

		if (isBlobUrl) {
			blobData = await t.blob();
			if (!blobData || blobData.size < 1000) {
				logDownload.warn(`Attempt ${attemptLabel}: probe failed (blob size too small)`, t);
				return fallback(url);
			}
		} else if (!UTIL.validateVideoRequest(t) || !t.body) {
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
			SPLASH.message('✓ Downloaded video', { duration: 2500, state: 1 });
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

