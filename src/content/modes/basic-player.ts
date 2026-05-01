import { DOM } from '@/content/core/dom';
import { createButton } from '@/content/ui/buttons';
import { itemData } from '@/content/items/data-registry';
import { downloadHook } from '@/content/download/flow/download-hook';

export const createBasicPlayerMode = () => (item, data) => {
	const videoElement = item.querySelector('video');
	if (!videoElement) return false;

	item.setAttribute('is-downloadable', 'true');

	const buttonWrapper = createButton.BASIC_PLAYER();
	const parent = data.container.closest('div[class*="-DivLeftContainer "]');
	if (!parent) return false;

	const existingButton = parent.querySelector(`.${buttonWrapper.classList[0]}`);
	if (existingButton) existingButton.remove();

	parent.insertBefore(buttonWrapper, parent.children[0].nextSibling);

	const button = buttonWrapper.querySelector<HTMLAnchorElement>('a');
	if (!button) return false;
	button.ttdbItem = item;

	const widthTarget = parent.querySelector('div[class*="-DivInfoContainer "]') as HTMLElement | null;
	DOM.setStyle(button, { width: `${Math.min(widthTarget ? widthTarget.offsetWidth : 240, 240)}px` });

	const videoData = itemData.get(item, data);
	if (!videoData.url || button.ttIsProcessed) return false;

	buttonWrapper.style.display = 'inherit';
	setTimeout(() => button.style.opacity = '1', 50);
	downloadHook(button, videoData);
	button.ttIsProcessed = true;
	return true;
};

