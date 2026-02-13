import { TTDB } from '../state';
import { createButton } from '../ui/buttons';
import { itemData } from '../item-data';
import { downloadHook } from '../download/download-hook';
import { pipe } from '../logging';
import { collectSlideshowImageUrls } from '../slideshow/collect-image-urls';
import { openSlideshowPicker } from '../slideshow/picker';

const BROWSER_ACTION_CONTAINER_SELECTORS = {
	appPrimary: 'div[class*="-DivCopyLinkContainer"], div[class*="-DivTabMenuContainer"], [data-e2e="browse-copy"]',
	appFallback: 'div[class*="-FooterBtnWrapper"], section[class*="-SectionActionBarContainer"]',
	__nextPrimary: 'div.video-infos-container > div.action-container',
	__nextFallback: 'section[class*="-SectionActionBarContainer"], div[class*="-action-bar"].vertical'
};

const logBrowser = (...args) => {
	pipe('[BROWSER]', ...args);
};

const setBrowserButtonInteractive = (button) => {
	button.style.cursor = 'pointer';
	button.style.pointerEvents = 'auto';
};

const querySlotContainer = (item, selector) => {
	return item.querySelector(selector) || document.querySelector(selector);
};

const resolveBrowserActionSlot = (item, data) => {
	if (data.env === TTDB.ENV.APP) {
		// Prefer the current item subtree to avoid grabbing controls from a stale/adjacent card.
		// Keep document fallback for layouts where controls are rendered outside the item root.
		const primary = querySlotContainer(item, BROWSER_ACTION_CONTAINER_SELECTORS.appPrimary);
		if (primary) {
			return { container: primary, insert: 'before' };
		}

		const fallback = querySlotContainer(item, BROWSER_ACTION_CONTAINER_SELECTORS.appFallback);
		if (fallback) {
			const insert = fallback.matches('section[class*="-SectionActionBarContainer"]') ? 'prepend' : 'append';
			return { container: fallback, insert };
		}

		return null;
	}

	if (data.env === TTDB.ENV.__NEXT) {
		const primary = querySlotContainer(item, BROWSER_ACTION_CONTAINER_SELECTORS.__nextPrimary);
		if (primary) {
			return { container: primary, insert: 'after' };
		}

		const fallback = querySlotContainer(item, BROWSER_ACTION_CONTAINER_SELECTORS.__nextFallback);
		if (fallback) {
			const insert = fallback.matches('section[class*="-SectionActionBarContainer"]') ? 'prepend' : 'append';
			return { container: fallback, insert };
		}
	}

	return null;
};

const placeBrowserButton = (slot, button) => {
	if (!slot || !slot.container) return;

	if (slot.insert === 'before') {
		slot.container.before(button);
		return;
	}

	if (slot.insert === 'after') {
		slot.container.after(button);
		return;
	}

	if (slot.insert === 'prepend') {
		slot.container.prepend(button);
		return;
	}

	slot.container.appendChild(button);
};

const injectBrowserActionButton = (data) => {
	const { resolveActionSlot, button, initializeButton, observeRoot } = data;

	const ensureInjected = () => {
		const slot = resolveActionSlot();
		if (!slot || !slot.container) return;

		if (!button.ttIsInitialized) {
			initializeButton(button);
			button.ttIsInitialized = true;
		}

		if (!button.isConnected) {
			placeBrowserButton(slot, button);
			setTimeout(() => {
				button.style.opacity = 1;
			}, 50);
		}
	};

	ensureInjected();

	const slot = resolveActionSlot();
	const observeTarget = slot && slot.container
		? (slot.insert === 'append' || slot.insert === 'prepend'
			? slot.container
			: slot.container.parentNode)
		: observeRoot;
	if (!observeTarget) return;

	let timer = null;
	const observer = new MutationObserver(() => {
		ensureInjected();
		clearTimeout(timer);
		timer = setTimeout(() => observer.disconnect(), 1E5);
	});

	observer.observe(observeTarget, {
		childList: true,
		subtree: true
	});
};

const attachBrowserSlideshowPickerLauncher = (button, item) => {
	if (button.ttHasSlideshowPickerLauncher) return;

	button.ttHasSlideshowPickerLauncher = true;
	button.setAttribute('data-ttdb-content-type', 'slideshow');

	button.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation?.();

		const imageUrls = collectSlideshowImageUrls(item);
		if (!imageUrls.length) {
			logBrowser('Slideshow button clicked, but no image URLs were found.');
			return;
		}

		logBrowser('Slideshow image URLs', {
			count: imageUrls.length,
			urls: imageUrls
		});

		openSlideshowPicker({
			imageUrls,
			assetIdPrefix: 'browser-image'
		});
	});
};

const setupBrowserVideoObserver = (button, item, data) => {
	if (TTDB.observers.browserObserver) {
		TTDB.observers.browserObserver.disconnect();
	}

	const callback = (mutationsList) => {
		for (const mutation of mutationsList) {
			if (mutation.type === 'childList') {
				clearTimeout(TTDB.timers.browserObserver);
				TTDB.timers.browserObserver = setTimeout(() => {
					downloadHook(button, itemData.get(item, data));
				}, 100);
			}
		}
	};

	TTDB.observers.browserObserver = new MutationObserver(callback);
	TTDB.observers.browserObserver.observe(item, {
		childList: true,
		subtree: true
	});
};

export const createBrowserMode = () => (item, data) => {
	const button = createButton.BROWSER();
	button.ttdbItem = item;
	button.setAttribute('ttdb_mode', data.env === TTDB.ENV.__NEXT ? '__NEXT' : 'APP');

	const slideshowUrls = collectSlideshowImageUrls(item);
	const hasVideoElement = !!item.querySelector(
		'div.tiktok-web-player > video, div[id^="xgwrapper-"] video, video[data-version], video[src]'
	);

	// Browser photo-mode cards use swiper slides without a playable <video>.
	// Route those to the asset picker instead of the video download hook.
	if (slideshowUrls.length > 0 && !hasVideoElement) {
		injectBrowserActionButton({
			resolveActionSlot: () => resolveBrowserActionSlot(item, data),
			button,
			observeRoot: item,
			initializeButton: (browserButton) => {
				attachBrowserSlideshowPickerLauncher(browserButton, item);
				setBrowserButtonInteractive(browserButton);
				browserButton.ttIsProcessed = true;
			}
		});

		item.setAttribute('is-downloadable', 'true');
		return true;
	}

	// Do not inject a button if we cannot resolve either:
	// - slideshow image URLs, or
	// - a playable video element.
	if (!hasVideoElement) {
		return false;
	}

	const videoData = itemData.get(item, data);
	injectBrowserActionButton({
		resolveActionSlot: () => resolveBrowserActionSlot(item, data),
		button,
		observeRoot: item,
		initializeButton: (browserButton) => {
			downloadHook(browserButton, videoData);
			setupBrowserVideoObserver(browserButton, item, data);
			browserButton.ttIsProcessed = true;
		}
	});

	item.setAttribute('is-downloadable', 'true');
	return true;
};

