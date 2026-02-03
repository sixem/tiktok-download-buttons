// Grid-mode extraction for thumbnail cards.
import { EXPR } from '../state';

const GRID_LINK_SELECTOR = 'a[href*="com/@"]';

export const extractGridData = (data) => {
	const videoData: any = {};
	const itemLinks = data.container.querySelectorAll(GRID_LINK_SELECTOR);

	(itemLinks).forEach((link) => {
		const matches = EXPR.vanillaVideoUrl(link.getAttribute('href'), {
			strict: true
		});

		if (matches) {
			const [, user, id] = matches;

			videoData.user = user;
			videoData.id = id;

			if (/^\d+$/.test(id)) {
				videoData.videoApiId = id;
			}
		}
	});

	return videoData;
};
