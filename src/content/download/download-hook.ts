import { TTDB, SPLASH } from '../state';
import { DOM } from '../dom';
import { getStoredSetting } from '../utils/storage';
import { getWebApiData } from '../api/web-detail';
import { getItemDetailApiData } from '../api/item-detail';
import { getFileNameTemplate } from './filename';
import { downloadFile } from './download-file';
import { getVideoUrlFromButtonContext } from '../extractors/video-url';

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
		button.addEventListener('click', async (e) => {
			e.preventDefault();

			if (button.classList.contains('loading')) {
				return false;
			} else {
				button.classList.add('loading');
			}

			const attrFilename = button.getAttribute('filename') || null;
			const attrApiId = button.getAttribute('video-id') || null;
			const attrUrl = button.getAttribute('href') || null;
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

			let nameTemplate = await getStoredSetting('download-naming-template');

			if (!(typeof nameTemplate === 'string' || nameTemplate instanceof String) || nameTemplate.length < 1) {
				nameTemplate = false;
			} else {
				nameTemplate = nameTemplate.trim();
			}

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

			const usageData = {
				videoUrl: attrUrl,
				filename: attrFilename
			};
			let resolvedSource = attrUrl ? 'button-attr' : null;

			const domVideoUrl = getVideoUrlFromButtonContext(button);
			const preferDomUrl = !!domVideoUrl && !domVideoUrl.startsWith('blob:');
			if (domVideoUrl) {
				usageData.videoUrl = domVideoUrl;
				resolvedSource = domVideoUrl.startsWith('blob:') ? 'dom-blob' : 'dom';
				logDownload.info(`Attempt ${attemptLabel}: DOM URL found`, {
					videoKey: attemptKey,
					url: domVideoUrl,
					source: resolvedSource
				});
			}

			await getWebApiData({
				...videoData,
				...{
					videoApiId: attrApiId
				}
			}).then(async (webData) => {
				const webVideoUrl = getWebVideoUrl(webData);
				if (webVideoUrl) {
					const used = !preferDomUrl;
					if (!preferDomUrl) {
						usageData.videoUrl = webVideoUrl;
						resolvedSource = 'web-api';
					}

					if (nameTemplate) {
						usageData.filename = getFileNameTemplate(videoData, webData, nameTemplate);
					}

					logDownload.info(`Attempt ${attemptLabel}: web API URL`, {
						videoKey: attemptKey,
						used,
						url: webVideoUrl
					});
					logDownload.info(`Attempt ${attemptLabel}: web API data found`, {
						videoKey: attemptKey,
						response: webData
					});
				}
			}).catch(async (error) => {
				logDownload.warn(`Attempt ${attemptLabel}: web API failed, trying item detail API`, error);

				try {
					const itemDetailData = await getItemDetailApiData(attrApiId);
					const itemDetailUrl = getWebVideoUrl(itemDetailData);

					if (itemDetailUrl) {
						const used = !preferDomUrl;
						if (!preferDomUrl) {
							usageData.videoUrl = itemDetailUrl;
							resolvedSource = 'item-detail-api';
						}

						if (nameTemplate) {
							usageData.filename = getFileNameTemplate(videoData, itemDetailData, nameTemplate);
						}

						logDownload.info(`Attempt ${attemptLabel}: item detail API URL`, {
							videoKey: attemptKey,
							used,
							url: itemDetailUrl
						});
						logDownload.info(`Attempt ${attemptLabel}: item detail API data found`, {
							videoKey: attemptKey,
							response: itemDetailData
						});
					}
				} catch (itemError) {
					logDownload.warn(`Attempt ${attemptLabel}: item detail API failed`, itemError);
				}
			}).finally(() => {
				if (!usageData.filename) {
					usageData.filename = attrFilename;
				}
			});

			if (!usageData.videoUrl) {
				logDownload.warn(`Attempt ${attemptLabel}: no video URL resolved`, {
					videoKey: attemptKey,
					filename: usageData.filename,
					videoId: attrApiId
				});
				SPLASH.message('✘ No video URL was found for download.', {
					duration: 5000, state: 3
				});
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
		});

		button.hasListener = true;
	}

	DOM.setStyle(button, {
		cursor: 'pointer',
		'pointer-events': 'auto'
	});

	return button;
};

