import { TTDB } from './state';
import { DOM } from './dom';
import { pipe } from './logging';
import { itemSetup } from './item-setup';

export const getAppContainer = () => {
	return document.querySelector(DOM.multiSelector({
		APP: 'div#app',
		__NEXT: 'div#main'
	}));
};

export const selectAllVideoItems = () => {
	const selectors = DOM.multiSelector({
		appShareOverlay: 'div.TUXModal > div[data-e2e="share-group"]:not([is-downloadable])',
		appItemContainer: 'div[class*="-DivItemContainer"]:not([is-downloadable]):not([class*="-kdocy-"])',
		appBrowserMode: 'div[class*="-DivBrowserModeContainer "]:not([is-downloadable])',
		appForYouArticle: 'main > div#column-list-container > article:not([is-downloadable])',
		appForYouArticleData: 'article[data-e2e="recommend-list-item-container"]:not([is-downloadable])',
		appForYouArticleId: 'article[id^="one-column-item-"]:not([is-downloadable])',
		appBasicPlayer: 'div[class*="-DivLeftContainer "] div[class*="-DivVideoContainer "] \
			div[class*="-DivContainer "]:not([is-downloadable])',
		__nextGrid: 'div.video-feed div.video-feed-item:not([is-downloadable])',
		__nextBig: 'div.video-feed-container div.feed-item-content:not([is-downloadable])',
		__nextBrowser: 'div.tt-feed div.video-card-big.browse-mode:not([is-downloadable])'
	});

	return document.querySelectorAll(selectors);
};

export const updateItems = () => {
	let processed = 0;

	(selectAllVideoItems()).forEach((item) => {
		let currentMode = null;
		let currentEnvironment = null;

		const modeElement = item.querySelector('div[mode]');

		if (modeElement) {
			currentMode = modeElement.getAttribute('mode');
			currentEnvironment = TTDB.ENV.APP;
		} else {
			const classList = item.classList;

			if (classList.contains('video-feed-item') || classList.contains('three-column-item')) {
				currentMode = TTDB.MODE.GRID;
			} else if (classList.contains('feed-item-content')) {
				currentMode = TTDB.MODE.FEED;
			} else if (classList.contains('browse-mode') || classList.contains('video-card-big')) {
				currentMode = TTDB.MODE.BROWSER;
			} else if (item.querySelector('div.tiktok-web-player > video')) {
				currentMode = TTDB.MODE.BASIC_PLAYER;
			} else if (item.querySelector('input[value*="/video/"]')) {
				currentMode = TTDB.MODE.SHARE_OVERLAY;
			}

			if (currentMode !== null) {
				currentEnvironment = TTDB.ENV.__NEXT;
			}
		}

		if (currentMode) {
			if (currentEnvironment === null) {
				currentEnvironment = TTDB.DEFAULT_ENV;
			}

			if (itemSetup.set(currentMode, item, {
				mode: currentMode,
				env: currentEnvironment,
				container: item
			})) {
				processed++;
			}
		}
	});

	return processed;
};

export const updatePage = () => {
	const processedItems = updateItems();

	if (processedItems > 0) {
		pipe(`Processed ${processedItems} item${processedItems !== 1 ? 's' : ''}!`);
	}
};

const debounce = (f, ms) => {
	let timeout;

	return (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => f.apply(this, args), ms);
	};
};

export const observeApp = (container) => {
	if (TTDB.observers.main) {
		TTDB.observers.main.disconnect();
	}

	const debouncedCallback = debounce((mutationsList) => {
		for (let mutation of mutationsList) {
			if (mutation.type === 'childList') {
				TTDB.setInterval(15);
				break;
			}
		}
	}, 2000);

	TTDB.observers.main = new MutationObserver(debouncedCallback);
	TTDB.observers.main.observe(container, { childList: true, subtree: true });

	pipe('Watching for DOM changes ...');
};

export const startUpdateLoop = () => {
	setInterval(() => {
		if (TTDB.interval.counter > 0) {
			updatePage();
			TTDB.interval.counter--;
		}
	}, TTDB.interval.delay);
};

