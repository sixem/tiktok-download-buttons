// Basic player extraction for the standalone player layout.
import { EXPR } from '@/content/state';
import { getTextContent, getUserFromProfileLink } from '@/content/item-data/extraction-helpers';

const BASIC_PLAYER_SELECTORS = {
	parent: 'div[class*="-DivLeftContainer "]',
	userId: 'span[class*="-SpanUniqueId "], span[data-e2e="browse-username"]',
	authorContainer: 'div[class*="-DivAuthorContainer "]',
	profileLink: 'a[href^="/@"]',
	tags: 'span[class*="-SpanText "], a[href^="/tag/"] strong[class*="-StrongText "]'
};

export const extractBasicPlayerData = (data) => {
	const videoData: any = {};
	const parent = data.container.closest(BASIC_PLAYER_SELECTORS.parent);

	if (parent) {
		const userIdElement = parent.querySelector(BASIC_PLAYER_SELECTORS.userId);

		if (userIdElement) {
			videoData.user = getTextContent(userIdElement);
		} else {
			const authorElement = parent.querySelector(BASIC_PLAYER_SELECTORS.authorContainer);

			if (authorElement) {
				const profileLink = authorElement.querySelector(BASIC_PLAYER_SELECTORS.profileLink);
				const userFromLink = getUserFromProfileLink(profileLink);

				if (userFromLink) {
					videoData.user = userFromLink;
				} else {
					videoData.user = 'tiktok_video';
				}
			}
		}

		let videoTags = parent.querySelectorAll(BASIC_PLAYER_SELECTORS.tags);

		if (videoTags) {
			videoTags = [...videoTags].map((e) => {
				return e.textContent ? e.textContent.trim() : false;
			});

			videoTags = videoTags.filter((e) => e);
			videoData.id = videoTags.join(' ');
		}
	}

	const matches = EXPR.vanillaVideoUrl(window.location.href);

	if (matches) {
		const [, user, videoId] = matches;

		videoData.videoApiId = videoId;
		videoData.user = user;
	}

	return videoData;
};
