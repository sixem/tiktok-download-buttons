// Prefer direct HTTP(S) sources over blob URLs when possible.
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
	const container = buttonElement.closest('[is-downloadable]')
		|| buttonElement.closest('article')
		|| buttonElement.ttdbItem;

	if (container) {
		const containerVideo = container.querySelector('video');
		const containerUrl = getVideoUrlFromElement(containerVideo);
		if (containerUrl) return containerUrl;
	}

	const videos = Array.from(document.querySelectorAll('video'));
	const playing = videos.find((video) => !video.paused);
	const playingUrl = getVideoUrlFromElement(playing);
	if (playingUrl) return playingUrl;

	for (const video of videos) {
		const url = getVideoUrlFromElement(video);
		if (url) return url;
	}

	return null;
};
