import { EXPR } from '../state';

export const findVideoUrls = (element) => {
	if (element) {
		const anchors = element.querySelectorAll('a[href]');

		for (let i = 0; i < anchors.length; i++) {
			const matches = EXPR.vanillaVideoUrl(
				decodeURIComponent(anchors[i].getAttribute('href'))
			);

			if (matches) {
				const [, username, videoId] = matches;
				return { username, videoId };
			}
		}
	}

	return false;
};

