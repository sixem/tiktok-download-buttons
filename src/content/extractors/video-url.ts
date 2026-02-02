export const getVideoUrlFromElement = (videoElement) => {
	if (!videoElement) return null;
	let url = videoElement.currentSrc
		|| videoElement.src
		|| videoElement.getAttribute('src');

	if (!url) {
		const sourceElement = videoElement.querySelector('source');
		if (sourceElement) {
			url = sourceElement.src || sourceElement.getAttribute('src');
		}
	}

	return url || null;
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
