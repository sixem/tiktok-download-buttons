import { TTDB } from '../state';
import { DOM } from '../dom';
import { pipe } from '../logging';
import { createButton } from '../ui/buttons';
import { itemData } from '../item-data';
import { downloadHook } from '../download/download-hook';

export const createGridMode = () => (item, data) => {
	item.setAttribute('is-downloadable', 'true');

	const button = createButton.GRID();
	button.ttdbItem = item;

	const setButton = (videoData, button) => {
		pipe('Found video data:', videoData);

		const hasIdentity = !!(
			videoData.videoApiId
			|| videoData.user
			|| videoData.url
		);

		if (hasIdentity && !button.ttIsProcessed) {
			downloadHook(button, videoData);
			button.ttIsProcessed = true;
		}
	};

	setButton(itemData.get(item, data), button);

	item.addEventListener('mouseleave', () => {
		clearInterval(TTDB.timers.gridAwaitVideoData);
	});

	item.addEventListener('mouseenter', () => {
		if (!button.ttIsProcessed) {
			clearInterval(TTDB.timers.gridAwaitVideoData);

			let videoData = itemData.get(item, data);

			setButton(videoData, button);

			if (!button.ttIsProcessed) {
				TTDB.timers.gridAwaitVideoData = setInterval(() => {
					videoData = itemData.get(item, data);
					setButton(videoData, button);

					if (button.ttIsProcessed) {
						clearInterval(TTDB.timers.gridAwaitVideoData);
					}
				}, 100);
			}
		}
	});

	DOM.setStyle(item, { position: 'relative' });
	item.appendChild(button);
	setTimeout(() => { button.style.opacity = 1; }, 100);

	return true;
};

