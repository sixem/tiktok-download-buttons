// Observes the TikTok app DOM and queues new video items for processing.
import { TTDB } from './state';
import { DOM } from './dom';
import { pipe } from './logging';
import { itemSetup } from './item-setup';

const VIDEO_ITEM_SELECTORS = DOM.multiSelector({
	appShareOverlay: 'div.TUXModal > div[data-e2e="share-group"]:not([is-downloadable])',
	appItemContainer: 'div[class*="-DivItemContainer"]:not([is-downloadable]):not([class*="-kdocy-"])',
	appBrowserMode: 'div[class*="-DivBrowserModeContainer "]:not([is-downloadable])',
	appForYouArticle: 'main > div#column-list-container > article:not([is-downloadable])',
	appForYouArticleData: 'article[data-e2e="recommend-list-item-container"]:not([is-downloadable])',
	appForYouArticleId: 'article[id^="one-column-item-"]:not([is-downloadable])',
	appBasicPlayer: 'div[class*="-DivLeftContainer "] div[class*="-DivVideoContainer "] div[class*="-DivContainer "]:not([is-downloadable])',
	__nextGrid: 'div.video-feed div.video-feed-item:not([is-downloadable])',
	__nextBig: 'div.video-feed-container div.feed-item-content:not([is-downloadable])',
	__nextBrowser: 'div.tt-feed div.video-card-big.browse-mode:not([is-downloadable])'
});

const pendingRoots = new Set<ParentNode>();
let flushScheduled = false;
let initialScanQueued = false;
const MAX_ROOTS_PER_FLUSH = 8;

// --- Update loop (safe, bounded, non-stacking) -----------------------------
//
// TikTok is a very dynamic SPA. Some UI changes can happen without a clean "new node added"
// signal (virtualized lists, delayed hydration, etc.). We keep a small "update window"
// that re-checks pending roots for a short time after user interaction (scroll/click)
// or DOM mutations.
//
// The original implementation used an always-on `setInterval`. That is simple but wastes
// CPU by waking up forever even when there's no work. Here we keep the same semantics,
// but make the loop:
// - singleton (can't stack multiple timers),
// - self-stopping (no idle wakeups once `counter` reaches 0),
// - restartable (any call to `TTDB.setInterval()` will ensure the loop is running).

const ensureUpdateLoopRunning = () => {
	TTDB.timers = TTDB.timers || {};

	// `setInterval()` IDs are numbers in the page context.
	// Be explicit here so `0` (unlikely, but possible in some environments) doesn't bypass the guard.
	if (typeof TTDB.timers.updateLoop === 'number') {
		return;
	}

	TTDB.timers.updateLoop = window.setInterval(() => {
		if (TTDB.interval.counter > 0) {
			updatePage();
			TTDB.interval.counter--;
			return;
		}

		// No more scheduled work: stop to avoid idle CPU wakeups.
		clearInterval(TTDB.timers.updateLoop);
		TTDB.timers.updateLoop = null;
	}, TTDB.interval.delay);
};

const ensureSetIntervalStartsLoop = () => {
	// Wrap once per page lifetime. (Defensive: in case the content script is injected twice.)
	if ((TTDB as any).__ttdbSetIntervalWrapped) return;
	(TTDB as any).__ttdbSetIntervalWrapped = true;

	const original = TTDB.setInterval;
	if (typeof original !== 'function') return;

	TTDB.setInterval = (count) => {
		original(count);
		ensureUpdateLoopRunning();
	};
};

const isElement = (node: Node | null): node is Element => {
	return !!node && node.nodeType === Node.ELEMENT_NODE;
};

const isParentNode = (node: Node | null): node is ParentNode => {
	return !!node && typeof (node as ParentNode).querySelectorAll === 'function';
};

const queueRoot = (node: Node | null) => {
	if (!node || !isParentNode(node)) return;

	if (pendingRoots.has(node)) return;

	if (node instanceof Document) {
		pendingRoots.clear();
		pendingRoots.add(node);
		return;
	}

	if (isElement(node)) {
		for (const existing of pendingRoots) {
			if (existing === node) return;

			if (existing instanceof Document) {
				return;
			}

			if (isElement(existing)) {
				if (existing.contains(node)) {
					return;
				}

				if (node.contains(existing)) {
					pendingRoots.delete(existing);
				}
			}
		}
	}

	pendingRoots.add(node);
};

const shouldQueueNode = (node: Node | null) => {
	if (!isElement(node)) return false;

	if (node.matches(VIDEO_ITEM_SELECTORS)) {
		return true;
	}

	return !!node.querySelector(VIDEO_ITEM_SELECTORS);
};

const queueInitialScan = (root: ParentNode) => {
	if (initialScanQueued) return;
	initialScanQueued = true;
	queueRoot(root);
	scheduleFlush();
};

export const getAppContainer = () => {
	return document.querySelector(DOM.multiSelector({
		APP: 'div#app',
		__NEXT: 'div#main'
	}));
};

const collectVideoItems = (root: ParentNode) => {
	const items = new Set<Element>();

	if (root instanceof Element && root.matches(VIDEO_ITEM_SELECTORS)) {
		items.add(root);
	}

	root.querySelectorAll(VIDEO_ITEM_SELECTORS).forEach((item) => items.add(item));

	return items;
};

const detectItemMode = (item: Element) => {
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

	if (!currentMode) return null;

	return {
		mode: currentMode,
		env: currentEnvironment ?? TTDB.DEFAULT_ENV
	};
};

const processVideoItems = (items: Iterable<Element>) => {
	let processed = 0;

	for (const item of items) {
		const detected = detectItemMode(item);

		if (!detected) continue;

		if (itemSetup.set(detected.mode, item, {
			mode: detected.mode,
			env: detected.env,
			container: item
		})) {
			processed++;
		}
	}

	return processed;
};

const flushPendingRoots = (deadline?: { timeRemaining: () => number }) => {
	let processed = 0;
	let handledRoots = 0;

	while (pendingRoots.size > 0) {
		const root = pendingRoots.values().next().value as ParentNode;
		pendingRoots.delete(root);

		handledRoots++;
		if (root instanceof Element && !root.isConnected) {
			continue;
		}

		processed += processVideoItems(collectVideoItems(root));

		if (deadline && deadline.timeRemaining() < 5) {
			break;
		}

		if (!deadline && handledRoots >= MAX_ROOTS_PER_FLUSH) {
			break;
		}
	}

	if (pendingRoots.size > 0) {
		scheduleFlush();
	}

	if (processed > 0) {
		pipe(`Processed ${processed} item${processed !== 1 ? 's' : ''}!`);
	}
};

const scheduleFlush = () => {
	if (flushScheduled) return;
	flushScheduled = true;

	const runFlush = (deadline?: { timeRemaining: () => number }) => {
		flushScheduled = false;
		flushPendingRoots(deadline);
	};

	const idleCallback = (window as any).requestIdleCallback;

	if (typeof idleCallback === 'function') {
		idleCallback.call(window, runFlush, { timeout: 1000 });
		return;
	}

	setTimeout(() => runFlush(), 250);
};

export const updatePage = () => {
	if (pendingRoots.size === 0) return;
	scheduleFlush();
};

export const observeApp = (container) => {
	ensureSetIntervalStartsLoop();

	if (TTDB.observers.main) {
		TTDB.observers.main.disconnect();
	}

	TTDB.observers.main = new MutationObserver((mutationsList) => {
		let hasWork = false;

		for (const mutation of mutationsList) {
			if (mutation.type === 'childList') {
				mutation.addedNodes.forEach((node) => {
					if (shouldQueueNode(node)) {
						queueRoot(node);
						hasWork = true;
					}
				});
			}

			if (mutation.type === 'attributes') {
				if (mutation.target instanceof Element && mutation.target.matches(VIDEO_ITEM_SELECTORS)) {
					queueRoot(mutation.target);
					hasWork = true;
				}
			}
		}

		if (hasWork) {
			TTDB.setInterval(15);
			scheduleFlush();
		}
	});

	TTDB.observers.main.observe(container, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class', 'mode', 'data-e2e', 'id']
	});

	queueInitialScan(container);
	pipe('Watching for DOM changes ...');
};

export const startUpdateLoop = () => {
	ensureSetIntervalStartsLoop();
	ensureUpdateLoopRunning();
};
