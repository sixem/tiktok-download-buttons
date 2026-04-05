import { DOM } from '../dom';
import { createButton } from '../ui/buttons';
import { itemData } from '../item-data';
import { downloadHook } from '../download/download-hook';

export const createBasicPlayerMode = () => (item, data) => {
	const videoElement = item.querySelector('video');
	if (!videoElement) return;

	item.setAttribute('is-downloadable', 'true');

	let button = createButton.BASIC_PLAYER();
	const parent = data.container.closest('div[class*="-DivLeftContainer "]');
	if (!parent) return;

	const existingButton = parent.querySelector(`.${button.classList[0]}`);
	if (existingButton) existingButton.remove();

	parent.children[0].parentNode.insertBefore(
		button, parent.children[0].nextSibling
	);

	button = button.querySelector('a');
	button.ttdbItem = item;

	const widthTarget = parent.querySelector('div[class*="-DivInfoContainer "]');
	DOM.setStyle(button, { width: `${Math.min(widthTarget ? widthTarget.offsetWidth : 240, 240)}px` });

	const videoData = itemData.get(item, data);
	if (!videoData.url || button.ttIsProcessed) return;

	button.parentNode.style.display = 'inherit';
	setTimeout(() => button.style.opacity = '1', 50);
	downloadHook(button, videoData);
	button.ttIsProcessed = true;
};

