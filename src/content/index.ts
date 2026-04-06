// Entry point for the content script bootstrap sequence.
import { TTDB, SPLASH } from '@/content/core/state';
import { setupLogging } from '@/content/core/logging';
import { setupUtils } from '@/content/utils/setup';
import { setupExpressions } from '@/content/extractors/expressions';
import { setupActiveDownloads } from '@/content/ui/active-downloads';
import { setupSplash } from '@/content/ui/splash';
import { setupAssetPickerModal } from '@/content/ui/asset-picker-modal';
import { setupAutoplayPreviewCapture } from '@/content/download/state/autoplay-preview-capture';
import { observeApp, getAppContainer, startUpdateLoop } from '@/content/observe';
import { getRuntimeInfo } from '@/content/utils';

export const bootstrap = () => {
	// Keep bootstrap idempotent so repeated content-script initialization does not
	// stack observers, timers, or global event listeners.
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

	const onScrollBreak = () => {
		clearTimeout(TTDB.timers.scrollBreak);
		TTDB.timers.scrollBreak = setTimeout(() => TTDB.setInterval(20), 250);
	};

	void getRuntimeInfo()
		.then((runtimeInfo) => {
			window.addEventListener(runtimeInfo.isFirefox ? 'DOMMouseScroll' : 'mousewheel', onScrollBreak);
		})
		.catch((error) => {
			TTDB.LOG?.warn?.('core', 'Failed to resolve runtime info for scroll listener', error);
		});

	window.addEventListener('click', () => TTDB.setInterval(10), { passive: true });
};

