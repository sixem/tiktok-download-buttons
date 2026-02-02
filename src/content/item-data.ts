import { TTDB, EXPR } from './state';
import { DOM } from './dom';
import { pipe } from './logging';
import { findVideoUrls } from './extractors/share';

const extractDescriptionId = (container, env = TTDB.ENV.APP) => {
	let identifier = null;
	let extracted = null;

	if (env === TTDB.ENV.APP) {
		const description = container.querySelector('span[class*="-SpanText "]');

		if (description) {
			extracted = description.parentElement.textContent;
		}
	} else if (env === TTDB.ENV.__NEXT) {
		const metaTitle = container.querySelector('div[class*="video-meta-caption"]');

		if (metaTitle) {
			extracted = metaTitle.textContent;
		}
	}

	if (extracted) {
		extracted = extracted.replace(/[/\\?%*:|"<>]/g, '-').toLowerCase().trim();

		if (extracted && extracted.length > 0) {
			identifier = extracted;
		}
	}

	return identifier;
};

export const itemData: any = { extract: {} };

itemData.extract[TTDB.MODE.FEED] = (data) => {
	const videoData = {};

	let itemUser = data.container.querySelector(DOM.multiSelector({
		app: 'a > [class*="AuthorTitle "]',
		__next: 'h3.author-uniqueId'
	}));

	if (itemUser) {
		videoData.user = itemUser.textContent;
	} else {
		itemUser = data.container.querySelector('a[href^="/@"]');

		if (itemUser) {
			videoData.user = itemUser.getAttribute('href').split('/@')[1];
			if (videoData.user.includes('?')) {
				videoData.user = videoData.user.split('?')[0];
			}
		}
	}

	const descriptionIdentifier = extractDescriptionId(data.container, data.env);

	videoData.id = descriptionIdentifier ? descriptionIdentifier : Date.now();

	return videoData;
};

itemData.extract[TTDB.MODE.GRID] = (data) => {
	const videoData = {};
	const itemLinks = data.container.querySelectorAll('a[href*="com/@"]');

	(itemLinks).forEach((link) => {
		const matches = EXPR.vanillaVideoUrl(link.getAttribute('href'), {
			strict: true
		});

		if (matches) {
			let [, user, id] = matches;

			videoData.user = user;
			videoData.id = id;

			if (/^\d+$/.test(id)) {
				videoData.videoApiId = id;
			}
		}
	});

	return videoData;
};

itemData.extract[TTDB.MODE.BROWSER] = (data) => {
	const videoData = {};

	let itemUser = null;

	if (data.env === TTDB.ENV.APP) {
		itemUser = data.container.querySelector('div[class*="-DivInfoContainer "] a[href*="/@"]');

		if (itemUser) {
			videoData.user = itemUser.getAttribute('href').split('/@')[1];
			if (videoData.user.includes('?')) {
				videoData.user = videoData.user.split('?')[0];
			}
		}

		const selectors = DOM.selectorNamed({
			xgWrapper: 'div[id*="xgwrapper-"]',
			spanUniqueId: 'span[class*="-SpanUniqueId"]',
			legacyCopyLink: 'p[class*="-PCopyLinkText"]'
		});

		if (selectors.xgWrapper) {
			const xgId = selectors.xgWrapper.getAttribute('id').split('-').pop();

			if (parseInt(xgId) > 0) {
				videoData.videoApiId = xgId;

				if (selectors.spanUniqueId) {
					videoData.user = selectors.spanUniqueId.innerText.trim();
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

		if (!videoData.videoApiId && selectors.legacyCopyLink) {
			const matches = EXPR.vanillaVideoUrl(selectors.legacyCopyLink.textContent);
			const [, username, videoId] = matches;

			videoData.user = username;
			videoData.videoApiId = videoId;

			pipe('[BROWSER] Extracted from copy link feature:', videoData);
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
		itemUser = data.container.querySelector('div.user-info a > h2.user-username');

		if (itemUser) {
			videoData.user = itemUser.textContent.trim();
		}
	}

	const descriptionIdentifier = extractDescriptionId(data.container, data.env);

	if (descriptionIdentifier) {
		videoData.id = descriptionIdentifier;
	}

	return videoData;
};

itemData.extract[TTDB.MODE.BASIC_PLAYER] = (data) => {
	const videoData = {};
	const parent = data.container.closest('div[class*="-DivLeftContainer "]');

	if (parent) {
		const userId = parent.querySelectorAll(
			'span[class*="-SpanUniqueId "], span[data-e2e="browse-username"]'
		);

		if (userId[0]) {
			videoData.user = userId[0].textContent.trim();
		} else {
			const authorElement = parent.querySelector('div[class*="-DivAuthorContainer "]');

			if (authorElement) {
				const userHref = authorElement.querySelectorAll('a[href^="/@"]');

				if (userHref[0]) {
					videoData.user = userHref[0].getAttribute('href').split('/@')[1].trim();
					if (videoData.user.includes('?')) {
						videoData.user = videoData.user.split('?')[0];
					}
				} else {
					videoData.user = 'tiktok_video';
				}
			}
		}

		let videoTags = parent.querySelectorAll(
			'span[class*="-SpanText "], a[href^="/tag/"] \
			strong[class*="-StrongText "]'
		);

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

itemData.get = (container, data) => {
	let videoData = { id: null, user: null, url: null };
	const videoElement = container.querySelector('video');

	if (videoElement) {
		videoData.url = videoElement.currentSrc
			|| videoElement.src
			|| videoElement.getAttribute('src');

		if (!videoData.url) {
			const sourceElement = videoElement.querySelector('source');

			if (sourceElement) {
				videoData.url = sourceElement.src || sourceElement.getAttribute('src');
			}
		}
	}

	if (itemData.extract[data.mode]) {
		videoData = {
			...videoData,
			...itemData.extract[data.mode](data)
		};

		if (!videoData.id) {
			videoData.id = Date.now();
		}
	}

	return videoData;
};

