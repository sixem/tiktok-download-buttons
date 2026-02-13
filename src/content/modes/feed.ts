import { TTDB } from '../state';
import { createButton } from '../ui/buttons';
import { itemData } from '../item-data';
import { downloadHook } from '../download/download-hook';
import { findVideoUrls } from '../extractors/share';
import { pipe } from '../logging';
import { collectSlideshowImageUrls } from '../slideshow/collect-image-urls';
import { openSlideshowPicker } from '../slideshow/picker';

const FEED_MEDIA_PREVIEW_SELECTORS = {
	app: ':scope > div:first-child',
	__next: 'div[class*="video-card"] > span[class$="mask"]'
};

const FEED_ACTION_BAR_SELECTORS = {
	app: 'section[class*="-SectionActionBarContainer"]',
	__next: 'div[class*="-action-bar"].vertical'
};

const logFeed = (...args) => {
	pipe('[FEED]', ...args);
};

const injectFeedActionButton = (data) => {
	const { resolveActionBar, button, initializeButton } = data;

	const ensureInjected = () => {
		const actionBar = resolveActionBar();
		if (!actionBar) return;

		if (!actionBar.querySelector('a.' + [...button.classList].join('.'))) {
			initializeButton(button);
			actionBar.prepend(button);

			setTimeout(() => {
				button.style.opacity = 1;
			}, 50);
		}
	};

	ensureInjected();

	let observer;
	let timer = null;
	const actionBar = resolveActionBar();
	if (!actionBar || !actionBar.parentNode) return;

	observer = new MutationObserver(() => {
		ensureInjected();
		clearTimeout(timer);

		timer = setTimeout(() => observer.disconnect(), 1E5);
	});

	observer.observe(actionBar.parentNode, {
		childList: true,
		subtree: true
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
	if (button.ttHasSlideshowPickerLauncher) return;

	button.ttHasSlideshowPickerLauncher = true;
	button.setAttribute('data-ttdb-content-type', 'slideshow');

	button.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation?.();

		const imageUrls = collectSlideshowImageUrls(item);

		if (!imageUrls.length) {
			logFeed('Slideshow button clicked, but no image URLs were found.');
			return;
		}

		logFeed('Slideshow image URLs', {
			count: imageUrls.length,
			urls: imageUrls
		});

		openSlideshowPicker({
			imageUrls,
			assetIdPrefix: 'feed-image'
		});
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

