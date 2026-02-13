import { TTDB } from '../state';
import { createButton } from '../ui/buttons';
import { itemData } from '../item-data';
import { downloadHook } from '../download/download-hook';
import { findVideoUrls } from '../extractors/share';
import { collectSlideshowImageUrls } from '../slideshow/collect-image-urls';
import { setDownloadButtonIconVariant } from '../ui/buttons';
import { injectActionButton } from './shared/action-button';
import { attachSlideshowLauncher } from './shared/slideshow-launcher';

const FEED_MEDIA_PREVIEW_SELECTORS = {
	app: ':scope > div:first-child',
	__next: 'div[class*="video-card"] > span[class$="mask"]'
};

const FEED_ACTION_BAR_SELECTORS = {
	app: 'section[class*="-SectionActionBarContainer"]',
	__next: 'div[class*="-action-bar"].vertical'
};

const injectFeedActionButton = (data) => {
	const { resolveActionBar, button, initializeButton } = data;
	injectActionButton<any>({
		resolveSlot: resolveActionBar,
		button,
		init: initializeButton,
		place: (actionBar, nextButton) => {
			actionBar.prepend(nextButton);
		},
		resolveObserveTarget: (actionBar) => {
			return actionBar && actionBar.parentNode ? actionBar.parentNode : null;
		},
		isButtonAlreadyPresent: (actionBar, nextButton) => {
			return !!actionBar.querySelector('a.' + [...nextButton.classList].join('.'));
		}
	});
};

const getFeedActionBar = (item, data) => {
	return item.querySelector(data.env === TTDB.ENV.APP ?
		FEED_ACTION_BAR_SELECTORS.app :
		FEED_ACTION_BAR_SELECTORS.__next
	);
};

const extractFeedVideoId = (element) => {
	// Prefer the canonical link-based ID when available.
	const shareData = findVideoUrls(element);
	if (shareData && shareData.videoId) {
		return shareData.videoId;
	}

	const xgWrapper = element.querySelector('div.xgplayer-container, div[id^="xgwrapper-"]');

	if (!xgWrapper || !xgWrapper.hasAttribute('id')) {
		return false;
	}

	const wrapperId = xgWrapper.getAttribute('id');
	const match = /xgwrapper-\d+-([0-9]+)/.exec(wrapperId);
	const videoId = match ? match[1] : wrapperId.split('-').pop();

	return videoId || false;
};

const attachFeedSlideshowPickerLauncher = (button, item) => {
	setDownloadButtonIconVariant(button, 'list');

	attachSlideshowLauncher({
		button,
		root: item,
		collectUrls: collectSlideshowImageUrls,
		pickerPrefix: 'feed-image',
		logNs: 'FEED'
	});
};

export const createFeedMode = () => (item, data) => {
	const mediaPreview = item.querySelector(data.env === TTDB.ENV.APP ?
		FEED_MEDIA_PREVIEW_SELECTORS.app :
		FEED_MEDIA_PREVIEW_SELECTORS.__next
	);

	if (mediaPreview) {
		if (!getFeedActionBar(item, data)) {
			return;
		}

		const videoData = itemData.get(item, data);
		const button = createButton.FEED();
		button.ttdbItem = item;

		if (!button.ttIsProcessed) {
			const feedVideoId = extractFeedVideoId(item);
			if (feedVideoId) {
				videoData.id = feedVideoId;
				videoData.videoApiId = feedVideoId;
				injectFeedActionButton({
					resolveActionBar: () => {
						return getFeedActionBar(item, data);
					},
					button,
					initializeButton: (feedButton) => {
						feedButton.setAttribute('video-id', videoData.id);
						setDownloadButtonIconVariant(feedButton, 'regular');
						downloadHook(feedButton, videoData);
						feedButton.ttIsProcessed = true;
					}
				});

				item.setAttribute('is-downloadable', 'true');
				return true;
			}

			const slideshowUrls = collectSlideshowImageUrls(item);
			if (slideshowUrls.length > 0) {
				injectFeedActionButton({
					resolveActionBar: () => {
						return getFeedActionBar(item, data);
					},
					button,
					initializeButton: (feedButton) => {
						attachFeedSlideshowPickerLauncher(feedButton, item);
						feedButton.ttIsProcessed = true;
					}
				});

				item.setAttribute('is-downloadable', 'true');
				return true;
			}
		}

		return true;
	}

	return false;
};

