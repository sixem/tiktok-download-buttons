// Browser-mode extraction for single video pages.
import { TTDB, EXPR } from '@/content/state';
import { pipe } from '@/content/logging';
import { findVideoUrls } from '@/content/extractors/share';
import {
	extractDescriptionId,
	getTextContent,
	getUserFromProfileLink,
	selectNamed
} from './extraction-helpers';

const APP_SELECTORS = {
	userLink: 'div[class*="-DivInfoContainer "] a[href*="/@"]',
	xgWrapper: 'div[id*="xgwrapper-"]',
	spanUniqueId: 'span[class*="-SpanUniqueId"]',
	legacyCopyLink: 'p[class*="-PCopyLinkText"]'
};

const NEXT_SELECTORS = {
	userName: 'div.user-info a > h2.user-username'
};

export const extractBrowserData = (data) => {
	const videoData: any = {};

	if (data.env === TTDB.ENV.APP) {
		const userLink = data.container.querySelector(APP_SELECTORS.userLink);
		const userFromLink = getUserFromProfileLink(userLink);

		if (userFromLink) {
			videoData.user = userFromLink;
		}

		const { xgWrapper, spanUniqueId, legacyCopyLink } = selectNamed(
			data.container,
			{
				xgWrapper: APP_SELECTORS.xgWrapper,
				spanUniqueId: APP_SELECTORS.spanUniqueId,
				legacyCopyLink: APP_SELECTORS.legacyCopyLink
			},
			document
		);

		if (xgWrapper) {
			const xgId = xgWrapper.getAttribute('id').split('-').pop();

			if (parseInt(xgId) > 0) {
				videoData.videoApiId = xgId;

				if (spanUniqueId) {
					videoData.user = getTextContent(spanUniqueId);
				}

				pipe('[BROWSER] Extracted from `xgwrapper`:', videoData);
			}
		}

		if (!videoData.videoApiId) {
			const matches = EXPR.vanillaVideoUrl(window.location.href);

			if (matches) {
				const [, user, videoId] = matches;

				videoData.videoApiId = videoId;
				videoData.user = user;

				pipe('[BROWSER] Extracted from window location:', videoData);
			}
		}

		if (!videoData.videoApiId && legacyCopyLink) {
			const matches = EXPR.vanillaVideoUrl(legacyCopyLink.textContent);

			if (matches) {
				const [, username, videoId] = matches;

				videoData.user = username;
				videoData.videoApiId = videoId;

				pipe('[BROWSER] Extracted from copy link feature:', videoData);
			}
		}

		if (!videoData.videoApiId) {
			const shareData = findVideoUrls(data.container);

			if (shareData) {
				videoData.user = shareData.username;
				videoData.videoApiId = shareData.videoId;

				pipe('[BROWSER] Extracted from share URLs:', videoData);
			}
		}
	} else if (data.env === TTDB.ENV.__NEXT) {
		const itemUser = data.container.querySelector(NEXT_SELECTORS.userName);

		if (itemUser) {
			videoData.user = getTextContent(itemUser);
		}
	}

	const descriptionIdentifier = extractDescriptionId(data.container, data.env);

	if (descriptionIdentifier) {
		videoData.id = descriptionIdentifier;
	}

	return videoData;
};
