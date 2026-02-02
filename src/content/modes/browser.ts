import { TTDB } from '../state';
import { createButton } from '../ui/buttons';
import { itemData } from '../item-data';
import { downloadHook } from '../download/download-hook';

export const createBrowserMode = () => (item, data) => {
	let linkContainer = null;

	if (data.env === TTDB.ENV.APP) {
		linkContainer = document.querySelector(
			'div[class*="-DivCopyLinkContainer"], div[class*="-DivTabMenuContainer"]'
		);
	} else if (data.env === TTDB.ENV.__NEXT) {
		linkContainer = item.querySelector('div.video-infos-container > div.action-container');
	}

	if (linkContainer) {
		item.setAttribute('is-downloadable', 'true');

		const button = createButton.BROWSER();
		button.ttdbItem = item;
		const videoData = itemData.get(item, data);

		if (data.env === TTDB.ENV.APP) {
			linkContainer.before(button);
		} else if (data.env === TTDB.ENV.__NEXT) {
			linkContainer.after(button);
		}

		button.setAttribute('ttdb_mode', data.env === TTDB.ENV.__NEXT ? '__NEXT' : 'APP');

		downloadHook(button, videoData);

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

		return true;
	}

	return false;
};

