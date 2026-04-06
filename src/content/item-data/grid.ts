// Grid-mode extraction for thumbnail cards.
import { EXPR } from '@/content/state';

// Grid cards can use absolute or relative page URLs.
//
// Examples:
// - https://www.tiktok.com/@user/video/<id>
// - /@user/video/<id>
const GRID_LINK_SELECTOR = 'a[href*="/@"][href*="/video/"], a[href*="tiktok.com/@"][href*="/video/"]';

export const extractGridData = (data) => {
	const videoData: any = {};
	const itemLinks = data.container.querySelectorAll(GRID_LINK_SELECTOR);

	(itemLinks).forEach((link) => {
		// Keep the canonical page URL for API fallbacks when no video tag exists.
		const rawHref = link.getAttribute('href');
		let pageUrl = rawHref;

		if (rawHref) {
			try {
				pageUrl = new URL(rawHref, window.location.origin).href;
			} catch (_) {
				pageUrl = rawHref;
			}
		}

		if (pageUrl && !videoData.pageUrl) {
			videoData.pageUrl = pageUrl;
		}

		const matches = pageUrl ? EXPR.vanillaVideoUrl(pageUrl) : null;

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
