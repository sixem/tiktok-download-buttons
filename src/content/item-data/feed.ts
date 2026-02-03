// Feed-mode extraction for scrolling timeline items.
import { TTDB } from '../state';
import { extractDescriptionId, getTextContent, getUserFromProfileLink, selectFirst } from './extraction-helpers';

const FEED_USER_SELECTORS = {
	app: 'a > [class*="AuthorTitle "]',
	__next: 'h3.author-uniqueId'
};

const PROFILE_LINK_SELECTOR = 'a[href^="/@"]';

export const extractFeedData = (data) => {
	const videoData: any = {};

	const itemUser = selectFirst(data.container, FEED_USER_SELECTORS);

	if (itemUser) {
		videoData.user = getTextContent(itemUser);
	} else {
		const profileLink = data.container.querySelector(PROFILE_LINK_SELECTOR);
		const userFromLink = getUserFromProfileLink(profileLink);

		if (userFromLink) {
			videoData.user = userFromLink;
		}
	}

	const descriptionIdentifier = extractDescriptionId(data.container, data.env);
	videoData.id = descriptionIdentifier ? descriptionIdentifier : Date.now();

	return videoData;
};
