import { EXPR } from '@/content/state';
import { normalizeUrl } from '@/content/utils';

export const findVideoUrls = (element) => {
	if (!element) return false;

	const anchors = element.querySelectorAll('a[href]');

	for (let i = 0; i < anchors.length; i++) {
		const href = normalizeUrl(anchors[i].getAttribute('href'), { decode: true });

		if (!href) continue;

		const matches = EXPR.vanillaVideoUrl(href);

		if (matches) {
			const [, username, videoId] = matches;
			return { username, videoId };
		}
	}

	return false;
};
