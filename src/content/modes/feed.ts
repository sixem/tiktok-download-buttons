import { TTDB, UTIL } from '../state';
import { createButton } from '../ui/buttons';
import { itemData } from '../item-data';
import { downloadHook } from '../download/download-hook';
import { findVideoUrls } from '../extractors/share';

const feedInjectButton = (data) => {
	const { getActionBar, button, videoData } = data;

	const inject = () => {
		const actionBar = getActionBar();

		if (!actionBar.querySelector('a.' + [...button.classList].join('.'))) {
			button.setAttribute('video-id', videoData.id);

			downloadHook(button, videoData);
			button.ttIsProcessed = true;
			actionBar.prepend(button);

			setTimeout(() => {
				button.style.opacity = 1;
			}, 50);
		}
	};

	inject();

	let observer;
	let timer = null;

	observer = new MutationObserver(() => {
		inject();
		clearTimeout(timer);

		timer = setTimeout(() => observer.disconnect(), 1E5);
	});

	observer.observe(getActionBar().parentNode, {
		childList: true,
		subtree: true
	});
};

const feedGetActionBar = (item, data) => {
	return item.querySelector(data.env === TTDB.ENV.APP ?
		'section[class*="-SectionActionBarContainer"]' :
		'div[class*="-action-bar"].vertical'
	);
};

const feedExtractVideoId = (element) => {
	const xgWrapper = element.querySelector('div.xgplayer-container, div[id^="xgwrapper-"]');

	if (!xgWrapper || !xgWrapper.hasAttribute('id')) {
		return false;
	}

	const wrapperId = xgWrapper.getAttribute('id');
	const match = /xgwrapper-\d+-([0-9]+)/.exec(wrapperId);
	const videoId = match ? match[1] : wrapperId.split('-').pop();

	return videoId || false;
};

const feedShareExtractIdLegacy = (element, callback, timeout = 500) => {
	let timer = null;
	let attempt;

	const shareButton = element.querySelector('div[role="button"][data-e2e="share-btn"] > button:not(.attempted)');
	const shareButtonSvg = shareButton.querySelector('span > svg');

	if (!shareButtonSvg || !shareButton) {
		callback(false);
	}

	const respond = (response, existing = false) => {
		if (!existing) {
			setTimeout(() => shareButton.classList.remove('extract'), 500);
			clearTimeout(timer);
			UTIL.dispatchEvent(shareButtonSvg, MouseEvent, 'click');
		}
		callback(response);
	};

	const onMutate = (mutationsList) => {
		for (let mutation of mutationsList) {
			if (mutation.type === 'childList') {
				const attempt = findVideoUrls(element.querySelector('div[class*="-DivContainer "]'));

				if (attempt) {
					observer.disconnect();
					respond(attempt);
					break;
				}
			}
		}
	};

	let existingShare = element.querySelector('div[class*="-DivContainer "]');

	if (existingShare) {
		attempt = findVideoUrls(existingShare.cloneNode(true));

		if (attempt) {
			respond(attempt, true);
		} else {
			existingShare = false;
		}
	}

	if (!existingShare) {
		observer = new MutationObserver(onMutate);
		observer.observe(shareButton, { childList: true, subtree: true });

		shareButton.classList.add('extract');

		UTIL.dispatchEvent(shareButtonSvg, MouseEvent, 'click');

		timer = setTimeout(() => {
			observer.disconnect();
			respond(false);
		}, timeout);
	}

	return false;
};

export const createFeedMode = () => (item, data) => {
	const videoPreview = item.querySelector(data.env === TTDB.ENV.APP ?
		':scope > div:first-child' :
		'div[class*="video-card"] > span[class$="mask"]'
	);

	if (videoPreview) {
		if (!feedGetActionBar(item, data)) {
			return;
		}

		const videoData = itemData.get(item, data);
		const button = createButton.FEED();
		button.ttdbItem = item;

		if (!button.ttIsProcessed) {
			const feedVideoId = feedExtractVideoId(item);
			if (feedVideoId) {
				videoData.id = feedVideoId;
				videoData.videoApiId = feedVideoId;
				feedInjectButton({
					getActionBar: () => {
						return feedGetActionBar(item, data);
					},
					button,
					videoData
				});

				item.setAttribute('is-downloadable', 'true');
			}
		}

		return true;
	}

	return false;
};

