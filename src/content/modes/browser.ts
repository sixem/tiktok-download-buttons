import { TTDB } from '@/content/core/state';
import { createButton, setDownloadButtonIconVariant } from '@/content/ui/buttons';
import { itemData } from '@/content/items/data-registry';
import { downloadHook } from '@/content/download/flow/download-hook';
import { collectSlideshowImageUrls } from '@/content/slideshow/collect-image-urls';
import { injectActionButton } from '@/content/modes/shared/action-button';
import { attachSlideshowLauncher } from '@/content/modes/shared/slideshow-launcher';

const BROWSER_ACTION_CONTAINER_SELECTORS = {
	appPrimary: 'div[class*="-DivCopyLinkContainer"], div[class*="-DivTabMenuContainer"], [data-e2e="browse-copy"]',
	appFallback: 'div[class*="-FooterBtnWrapper"], section[class*="-SectionActionBarContainer"]',
	__nextPrimary: 'div.video-infos-container > div.action-container',
	__nextFallback: 'section[class*="-SectionActionBarContainer"], div[class*="-action-bar"].vertical'
};

const setBrowserButtonInteractive = (button) => {
	button.style.cursor = 'pointer';
	button.style.pointerEvents = 'auto';
};

const hasBrowserVideoElement = (item) => {
	return !!item.querySelector(
		'div.tiktok-web-player > video, div[id^="xgwrapper-"] video, video[data-version], video[src]'
	);
};

const resolveBrowserContentKind = (item) => {
	const slideshowUrls = collectSlideshowImageUrls(item);
	const hasVideoElement = hasBrowserVideoElement(item);

	if (slideshowUrls.length > 0 && !hasVideoElement) {
		return 'slideshow';
	}

	if (hasVideoElement) {
		return 'video';
	}

	return 'none';
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
	if (!slot?.container) return;

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
	injectActionButton<any>({
		resolveSlot: resolveActionSlot,
		button,
		init: initializeButton,
		place: placeBrowserButton,
		resolveObserveTarget: (slot) => {
			if (slot?.container) {
				return slot.insert === 'append' || slot.insert === 'prepend'
					? slot.container
					: slot.container.parentNode;
			}

			return observeRoot || null;
		}
	});
};

const attachBrowserSlideshowPickerLauncher = (button, item) => {
	attachSlideshowLauncher({
		button,
		root: item,
		collectUrls: collectSlideshowImageUrls,
		pickerPrefix: 'browser-image',
		logNs: 'BROWSER'
	});
};

const syncBrowserButtonBehavior = (button, item, data) => {
	const kind = resolveBrowserContentKind(item);

	if (kind === 'slideshow') {
		button.setAttribute('data-ttdb-content-type', 'slideshow');
		setDownloadButtonIconVariant(button, 'list');
		attachBrowserSlideshowPickerLauncher(button, item);
		setBrowserButtonInteractive(button);
		item.setAttribute('is-downloadable', 'true');
		return true;
	}

	if (kind === 'video') {
		button.setAttribute('data-ttdb-content-type', 'video');
		setDownloadButtonIconVariant(button, 'regular');
		downloadHook(button, itemData.get(item, data));
		setBrowserButtonInteractive(button);
		item.setAttribute('is-downloadable', 'true');
		return true;
	}

	button.setAttribute('data-ttdb-content-type', 'none');
	item.removeAttribute('is-downloadable');
	return false;
};

const setupBrowserContentObserver = (button, item, data) => {
	if (TTDB.observers.browserObserver) {
		TTDB.observers.browserObserver.disconnect();
	}

	const callback = (mutationsList) => {
		for (const mutation of mutationsList) {
			if (mutation.type === 'childList') {
				clearTimeout(TTDB.timers.browserObserver);
				TTDB.timers.browserObserver = setTimeout(() => {
					syncBrowserButtonBehavior(button, item, data);
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
	if (resolveBrowserContentKind(item) === 'none') {
		return false;
	}

	const button = createButton.BROWSER();
	button.ttdbItem = item;
	button.setAttribute('ttdb_mode', data.env === TTDB.ENV.__NEXT ? '__NEXT' : 'APP');
	injectBrowserActionButton({
		resolveActionSlot: () => resolveBrowserActionSlot(item, data),
		button,
		observeRoot: item,
		initializeButton: (browserButton) => {
			syncBrowserButtonBehavior(browserButton, item, data);
			setupBrowserContentObserver(browserButton, item, data);
			browserButton.ttIsProcessed = true;
		}
	});

	return true;
};

