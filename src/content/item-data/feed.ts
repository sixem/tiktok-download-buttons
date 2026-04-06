// Feed-mode extraction for scrolling timeline items.
import { findVideoUrls } from '@/content/extractors/share';
import { extractDescriptionId, getTextContent, getUserFromProfileLink, selectFirst } from '@/content/item-data/extraction-helpers';

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

	// Grab the canonical video ID when a link is available inside the feed item.
	const shareData = findVideoUrls(data.container);
	if (shareData) {
		if (!videoData.user) {
			videoData.user = shareData.username;
		}
		videoData.videoApiId = shareData.videoId;
		videoData.pageUrl = `https://www.tiktok.com/@${shareData.username}/video/${shareData.videoId}`;
	}

	const descriptionIdentifier = extractDescriptionId(data.container, data.env);
	if (descriptionIdentifier) {
		videoData.id = descriptionIdentifier;
	} else if (videoData.videoApiId) {
		videoData.id = videoData.videoApiId;
	} else {
		videoData.id = Date.now();
	}

	// If we have a video ID but still no page URL (e.g., missing username), build a generic permalink.
	if (!videoData.pageUrl && videoData.videoApiId) {
		if (videoData.user) {
			videoData.pageUrl = `https://www.tiktok.com/@${videoData.user}/video/${videoData.videoApiId}`;
		} else {
			videoData.pageUrl = `https://www.tiktok.com/video/${videoData.videoApiId}`;
		}
	}

	return videoData;
};
