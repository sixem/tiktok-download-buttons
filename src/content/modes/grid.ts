import { DOM } from '@/content/core/dom';
import { pipe } from '@/content/core/logging';
import { createButton } from '@/content/ui/buttons';
import { itemData } from '@/content/items/data-registry';
import { downloadHook } from '@/content/download/flow/download-hook';

export const createGridMode = () => (item, data) => {
	item.setAttribute('is-downloadable', 'true');

	const button = createButton.GRID();
	button.ttdbItem = item;

	// Grid items sometimes need a brief wait before `itemData` is available.
	// Keep the timer on the item so different cards do not interfere with each other.
	const clearAwaitTimer = () => {
		if (typeof item.ttdbAwaitVideoDataTimerId === 'number') {
			clearInterval(item.ttdbAwaitVideoDataTimerId);
			item.ttdbAwaitVideoDataTimerId = null;
		}
	};

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
		clearAwaitTimer();
	});

	item.addEventListener('mouseenter', () => {
		if (!button.ttIsProcessed) {
			clearAwaitTimer();

			let videoData = itemData.get(item, data);

			setButton(videoData, button);

			if (!button.ttIsProcessed) {
				item.ttdbAwaitVideoDataTimerId = setInterval(() => {
					videoData = itemData.get(item, data);
					setButton(videoData, button);

					if (button.ttIsProcessed) {
						clearAwaitTimer();
					}
				}, 100);
			}
		}
	});

	DOM.setStyle(item, { position: 'relative' });

	// Some "grid-like" layouts (e.g. "You may like" lists) start/stop their preview playback
	// based on hovering a *specific* cover element. If we append our overlay button at the root,
	// hovering the button can count as "leaving" the cover, which pauses the preview.
	//
	// We detect this newer card shape by the absence of `[mode]` (classic grid items have it),
	// then prefer inserting into the cover container so hover state keeps working.
	const looksLikeNoModeCard = !item.querySelector('[mode]');
	const coverContainer = looksLikeNoModeCard
		? item.querySelector('[class*="DivCoverContainer"]')
		: null;

	(coverContainer || item).appendChild(button);
	setTimeout(() => { button.style.opacity = '1'; }, 100);

	return true;
};

