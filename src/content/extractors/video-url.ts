// Prefer direct HTTP(s) sources over blob URLs when possible.
// Blob sources are often MediaSource-backed streams and are not reliably downloadable.
const pickBestVideoUrl = (candidates) => {
	const normalize = (value) => {
		if (!value) return null;
		const trimmed = String(value).trim();
		return trimmed.length > 0 ? trimmed : null;
	};

	const cleaned = candidates.map(normalize).filter(Boolean);
	if (!cleaned.length) return null;

	const httpUrl = cleaned.find((url) => /^https?:/i.test(url));
	if (httpUrl) return httpUrl;

	const protocolRelative = cleaned.find((url) => url.startsWith('//'));
	if (protocolRelative) return `https:${protocolRelative}`;

	const blobUrl = cleaned.find((url) => /^blob:/i.test(url));
	if (blobUrl) return blobUrl;

	return cleaned[0];
};

export const getVideoUrlFromElement = (videoElement) => {
	if (!videoElement) return null;

	const candidates = [
		videoElement.currentSrc,
		videoElement.src,
		videoElement.getAttribute('src'),
		videoElement.getAttribute('data-src'),
		videoElement.getAttribute('data-video-src'),
		videoElement.getAttribute('data-video-url')
	];

	const sources = videoElement.querySelectorAll('source');
	for (const source of sources) {
		candidates.push(source.src, source.getAttribute('src'));
	}

	return pickBestVideoUrl(candidates);
};

export const getVideoUrlFromButtonContext = (buttonElement) => {
	if (!buttonElement) return null;

	const isArticleScopedButton = buttonElement.classList.contains('ttdb__button_feed')
		|| buttonElement.classList.contains('ttdb__button_browser');

	// Only resolve videos from this button's own item.
	// If the local owner is unclear, fail instead of guessing.
	const container = buttonElement.ttdbItem
		|| buttonElement.closest('[is-downloadable]')
		|| (isArticleScopedButton ? buttonElement.closest('article') : null);

	if (!container || typeof container.querySelectorAll !== 'function') {
		return null;
	}

	// Some layouts can contain more than one <video> inside the same owned item root.
	// Stay local and return the first usable URL from that container only.
	const videos = container.querySelectorAll('video');
	for (const video of videos) {
		const url = getVideoUrlFromElement(video);
		if (url) return url;
	}

	return null;
};
