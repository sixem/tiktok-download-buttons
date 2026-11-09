import { TTDB } from '@/content/core/state';
import { pipe } from '@/content/core/logging';
import { parseRehydrationData, extractWebappDetail, extractMetaVideoInfo } from '@/content/extractors/rehydration';
import { normalizeUrl } from '@/content/utils';

// Normalize page URLs so fetches work with relative or protocol-relative links.
const normalizePageUrl = (pageUrl) => {
	return normalizeUrl(pageUrl);
};

const videoIdFromPageUrl = (value: string | null) => {
	if (!value) return null;
	try {
		const url = new URL(value, 'https://www.tiktok.com');
		if (url.hostname !== 'tiktok.com' && !url.hostname.endsWith('.tiktok.com')) return null;
		return /^\/@[^/]+\/video\/(\d+)\/?$/.exec(url.pathname)?.[1] || null;
	} catch (_) { return null; }
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
const extractJsonLdVideoInfo = (rootDocument, videoId: string | null = null) => {
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
			if (videoId) {
				const page = item.mainEntityOfPage;
				const ids = [item.url, item['@id'], typeof page === 'string' ? page : page?.['@id']]
					.map(videoIdFromPageUrl).filter(Boolean);
				// A verified page can also contain JSON-LD for recommended videos.
				if (!ids.length || ids.some((id) => id !== videoId)) continue;
			}

			const type = String(item['@type'] || item.type || '');
			const url = item.contentUrl || item.video?.contentUrl;

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
		/"downloadAddr":"([^"]+)"/g,
		/"playAddr":"([^"]+)"/g,
		/"playAddrH264":"([^"]+)"/g,
		/"playAddrBytevc1":"([^"]+)"/g,
		/"playAddr":\{"urlList":\["([^"]+)"/g,
		/"downloadAddr":\{"urlList":\["([^"]+)"/g
	];

	const urls = new Set<string>();
	for (const pattern of patterns) {
		for (const match of html.matchAll(pattern)) {
			const decoded = decodeEscapedValue(match[1]);
			if (decoded && /^https?:\/\//i.test(decoded)) urls.add(decoded);
		}
	}
	// A page can contain recommendations with their own playAddr values. Do not
	// guess which video an unstructured URL belongs to when there is more than one.
	return urls.size === 1 ? [...urls][0] : null;
};

// The raw HTML, meta and JSON-LD fallbacks are not keyed by video ID. Only use
// them if the fetched page explicitly identifies the requested TikTok post.
const pageIdentifiesVideo = (rootDocument, videoId: string, responseUrl: string) => {
	if (!rootDocument || !/^\d+$/.test(String(videoId))) return false;
	const finalId = videoIdFromPageUrl(responseUrl);
	if (finalId && finalId !== String(videoId)) return false;
	try {
		if (new URL(responseUrl, 'https://www.tiktok.com').pathname === '/404') return false;
	} catch (_) { return false; }
	const candidates = [
		rootDocument.querySelector('link[rel="canonical"]')?.getAttribute('href'),
		rootDocument.querySelector('meta[property="og:url"]')?.getAttribute('content'),
		rootDocument.querySelector('meta[name="twitter:url"]')?.getAttribute('content')
	].map(videoIdFromPageUrl).filter(Boolean);
	if (candidates.length > 0) return candidates.every((id) => id === String(videoId));

	// Some pages omit canonical metadata but identify their post in JSON-LD.
	const structuredIds: string[] = [];
	for (const script of rootDocument.querySelectorAll?.('script[type="application/ld+json"]') || []) {
		try {
			const parsed = JSON.parse(script.textContent || '');
			const nodes = (Array.isArray(parsed) ? parsed : [parsed]).flatMap((value) => value?.['@graph'] || [value]);
			for (const node of nodes) {
				if (!String(node?.['@type'] || '').includes('Video')) continue;
				const page = node.url || node['@id'] || node.mainEntityOfPage?.['@id'] || node.mainEntityOfPage;
				const id = typeof page === 'string' ? videoIdFromPageUrl(page) : null;
				if (id) structuredIds.push(id);
			}
		} catch (_) { /* Ignore malformed structured data. */ }
	}
	return structuredIds.length > 0 && structuredIds.every((id) => id === String(videoId));
};

// Export parsing helpers so the fallback behavior can be tested without wiring full fetch/DOM flows.
export const webDetailHelpers = {
	normalizePageUrl,
	decodeEscapedValue,
	extractJsonLdVideoInfo,
	extractVideoUrlFromHtml,
	pageIdentifiesVideo
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

		fetch(reqUrl, TTDB.headers).then(async (res) => {
			if (!res.ok) throw new Error(`Video page HTTP ${res.status}`);
			return { body: await res.text(), responseUrl: res.url || reqUrl };
		}).then(({ body, responseUrl }) => {
			const webDocument = (new DOMParser()).parseFromString(body, 'text/html');
			const UD = parseRehydrationData(webDocument);
			const { status, webappDetail } = extractWebappDetail(UD, videoId);

			pipe('Got web API response (fetch)', { status }, webappDetail);

			if (webappDetail && ![10216].includes(status)) {
				resolve(webappDetail); return;
			} else if (webappDetail && status === 10216) {
				reject('Video is private'); return;
			}

			if (!pageIdentifiesVideo(webDocument, String(videoId), responseUrl)) {
				reject('Video page identity could not be verified'); return;
			}
			const metaInfo = extractMetaVideoInfo(webDocument);
			const jsonLdInfo = extractJsonLdVideoInfo(webDocument, String(videoId));
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

