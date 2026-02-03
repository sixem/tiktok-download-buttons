import { EXPR } from '../state';

// Normalize anchor hrefs so both absolute and relative TikTok URLs can be parsed.
const normalizeVideoHref = (href) => {
	if (!href) return null;
	const trimmed = href.trim();
	if (!trimmed) return null;

	let decoded = trimmed;
	try {
		decoded = decodeURIComponent(trimmed);
	} catch (_) {
		decoded = trimmed;
	}

	if (decoded.startsWith('//')) {
		return `https:${decoded}`;
	}

	if (decoded.startsWith('/')) {
		try {
			return new URL(decoded, window.location.origin).href;
		} catch (_) {
			return decoded;
		}
	}

	return decoded;
};

export const findVideoUrls = (element) => {
	if (!element) return false;

	const anchors = element.querySelectorAll('a[href]');

	for (let i = 0; i < anchors.length; i++) {
		const href = normalizeVideoHref(anchors[i].getAttribute('href'));
		if (!href) continue;

		const matches = EXPR.vanillaVideoUrl(href);

		if (matches) {
			const [, username, videoId] = matches;
			return { username, videoId };
		}
	}

	return false;
};

