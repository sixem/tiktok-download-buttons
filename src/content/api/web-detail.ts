import { TTDB } from '@/content/core/state';
import { pipe } from '@/content/core/logging';
import { parseRehydrationData, extractWebappDetail, extractMetaVideoInfo } from '@/content/extractors/rehydration';
import { normalizeUrl } from '@/content/utils';

// Normalize page URLs so fetches work with relative or protocol-relative links.
const normalizePageUrl = (pageUrl) => {
	return normalizeUrl(pageUrl);
};

// Decode JSON-escaped URL strings (e.g. \u002F or escaped slashes).
const decodeEscapedValue = (value) => {
	if (!value) return null;

	const safe = String(value);
	try {
		return JSON.parse(`"${safe.replace(/"/g, '\\"')}"`);
	} catch (_) {
		return safe
			.replace(/\\u002F/gi, '/')
			.replace(/\\u0026/gi, '&')
			.replace(/\\\\/g, '\\');
	}
};

// Extract a usable URL from JSON-LD metadata when the rehydration data is missing.
const extractJsonLdVideoInfo = (rootDocument) => {
	if (!rootDocument) return null;

	const scripts = rootDocument.querySelectorAll('script[type="application/ld+json"]');

	for (const script of scripts) {
		const raw = (script.textContent || '').trim();
		if (!raw) continue;

		let parsed = null;
		try {
			parsed = JSON.parse(raw);
		} catch (_) {
			continue;
		}

		const candidates = Array.isArray(parsed) ? parsed : [parsed];
		const items: any[] = [];

		for (const candidate of candidates) {
			if (!candidate || typeof candidate !== 'object') continue;
			if (Array.isArray(candidate['@graph'])) {
				items.push(...candidate['@graph']);
			} else {
				items.push(candidate);
			}
		}

		for (const item of items) {
			if (!item || typeof item !== 'object') continue;

			const type = String(item['@type'] || item.type || '');
			const url = item.contentUrl || item.embedUrl || item.url || item.video?.contentUrl;

			if (url && (type.includes('Video') || type.includes('Social'))) {
				return {
					url,
					title: item.name || null,
					description: item.description || null
				};
			}
		}
	}

	return null;
};

// Fallback parser for raw HTML when the JSON payload is blocked.
const extractVideoUrlFromHtml = (html) => {
	if (!html) return null;

	const patterns = [
		/"downloadAddr":"([^"]+)"/,
		/"playAddr":"([^"]+)"/,
		/"playAddrH264":"([^"]+)"/,
		/"playAddrBytevc1":"([^"]+)"/,
		/"playAddr":\{"urlList":\["([^"]+)"/,
		/"downloadAddr":\{"urlList":\["([^"]+)"/
	];

	for (const pattern of patterns) {
		const match = pattern.exec(html);
		if (match?.[1]) {
			const decoded = decodeEscapedValue(match[1]);
			if (decoded) return decoded;
		}
	}

	return null;
};

// Export parsing helpers so the fallback behavior can be tested without wiring full fetch/DOM flows.
export const webDetailHelpers = {
	normalizePageUrl,
	decodeEscapedValue,
	extractJsonLdVideoInfo,
	extractVideoUrlFromHtml
};

export const getWebApiData = (videoData) => {
	return new Promise((resolve, reject) => {
		const pageUrl = normalizePageUrl(videoData.pageUrl);
		const fallbackId = pageUrl ? /\/video\/(\d+)/.exec(pageUrl)?.[1] : null;
		const videoId = videoData.videoApiId || fallbackId;

		if (!videoId) {
			reject('No video ID found in object'); return;
		}

		const documentUD = parseRehydrationData(document);
		if (documentUD) {
			const { status, webappDetail } = extractWebappDetail(documentUD, videoId);
			pipe('Got web API response (document)', { status }, webappDetail);

			if (webappDetail && ![10216].includes(status)) {
				resolve(webappDetail); return;
			} else if (webappDetail && status === 10216) {
				reject('Video is private'); return;
			}
		}

		const reqUrl = pageUrl
			|| (videoData.user
				? `https://www.tiktok.com/@${videoData.user}/video/${videoId}`
				: `https://www.tiktok.com/video/${videoId}`);

		fetch(reqUrl, TTDB.headers).then((res) => res.text()).then((body) => {
			const webDocument = (new DOMParser()).parseFromString(body, 'text/html');
			const UD = parseRehydrationData(webDocument);
			const { status, webappDetail } = extractWebappDetail(UD, videoId);

			pipe('Got web API response (fetch)', { status }, webappDetail);

			if (webappDetail && ![10216].includes(status)) {
				resolve(webappDetail); return;
			} else if (webappDetail && status === 10216) {
				reject('Video is private'); return;
			}

			const metaInfo = extractMetaVideoInfo(webDocument);
			const jsonLdInfo = extractJsonLdVideoInfo(webDocument);
			const htmlUrl = extractVideoUrlFromHtml(body);

			const fallbackInfo = metaInfo || jsonLdInfo;
			const fallbackUrl = fallbackInfo?.url || htmlUrl;

			if (fallbackUrl) {
				pipe('Using HTML video URL fallback.', {
					url: fallbackUrl,
					meta: fallbackInfo
				});
				resolve({
					video: { playAddr: [fallbackUrl] },
					desc: fallbackInfo?.description || null,
					__meta: fallbackInfo || { url: fallbackUrl }
				}); return;
			}

			reject(`Video is not available (status code: ${status})`);
		}).catch((error) => {
			reject(`Error fetching web data: ${error}`);
		});
	});
};

