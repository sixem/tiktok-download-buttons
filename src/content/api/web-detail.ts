import { pipe } from '../logging';
import { parseRehydrationData, extractWebappDetail, extractMetaVideoInfo } from '../extractors/rehydration';

export const getWebApiData = (videoData) => {
	return new Promise((resolve, reject) => {
		if (!videoData.videoApiId) {
			reject('No video ID found in object'); return;
		}

		const documentUD = parseRehydrationData(document);
		if (documentUD) {
			const { status, webappDetail } = extractWebappDetail(documentUD, videoData.videoApiId);
			pipe('Got web API response (document)', { status }, webappDetail);

			if (webappDetail && ![10216].includes(status)) {
				resolve(webappDetail); return;
			} else if (webappDetail && status === 10216) {
				reject('Video is private'); return;
			}
		}

		const reqUrl = `https://www.tiktok.com/@${videoData.user}/video/${videoData.videoApiId}`;

		fetch(reqUrl).then((res) => res.text()).then((body) => {
			const webDocument = (new DOMParser()).parseFromString(body, 'text/html');
			const UD = parseRehydrationData(webDocument);
			const { status, webappDetail } = extractWebappDetail(UD, videoData.videoApiId);

			pipe('Got web API response (fetch)', { status }, webappDetail);

			if (webappDetail && ![10216].includes(status)) {
				resolve(webappDetail); return;
			} else if (webappDetail && status === 10216) {
				reject('Video is private'); return;
			}

			const metaInfo = extractMetaVideoInfo(webDocument);
			if (metaInfo && metaInfo.url) {
				pipe('Using meta video URL fallback.', metaInfo);
				resolve({
					video: { playAddr: [metaInfo.url] },
					desc: metaInfo.description || null,
					__meta: metaInfo
				}); return;
			}

			reject(`Video is not available (status code: ${status})`);
		}).catch((error) => {
			reject('Error fetching web data: ' + error);
		});
	});
};

