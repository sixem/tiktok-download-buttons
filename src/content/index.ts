// Entry point for the content script bootstrap sequence.
import { TTDB, UTIL, SPLASH } from './state';
import { setupLogging } from './logging';
import { setupUtils } from './utils/index';
import { setupExpressions } from './extractors/expressions';
import { setupActiveDownloads } from './ui/active-downloads';
import { setupSplash } from './ui/splash';
import { setupAssetPickerModal } from './ui/asset-picker-modal';
import { setupAutoplayPreviewCapture } from './download/autoplay-preview-capture';
import { observeApp, getAppContainer, startUpdateLoop } from './observe';

export const bootstrap = () => {
	// Defensive: content scripts can be injected multiple times in some extension workflows
	// (for example during development, or if the page does a hard navigation and the old
	// script instance is still winding down). Keep bootstrap idempotent so we don't stack
	// observers, timers, or global event listeners.
	if (TTDB.__ttdbBootstrapped) return;
	TTDB.__ttdbBootstrapped = true;

	setupLogging();
	setupUtils();
	setupExpressions();
	setupActiveDownloads();
	setupSplash();
	setupAssetPickerModal();
	setupAutoplayPreviewCapture();

	let appContainer = getAppContainer();

	if (appContainer) {
		observeApp(appContainer);
	} else {
		let checks = 0;

		TTDB.timers.appCreationWatcher = setInterval(() => {
			appContainer = getAppContainer();

			if (appContainer || checks === 10) {
				clearInterval(TTDB.timers.appCreationWatcher);

				if (appContainer) {
					observeApp(appContainer);
				}
			}
			checks++;
		}, 1000);
	}

	startUpdateLoop();

	SPLASH.create();

	window.addEventListener(!UTIL.isChromium() ? 'DOMMouseScroll' : 'mousewheel', () => {
		clearTimeout(TTDB.timers.scrollBreak);
		TTDB.timers.scrollBreak = setTimeout(() => TTDB.setInterval(20), 250);
	});

	window.addEventListener('click', () => TTDB.setInterval(10), { passive: true });
};

