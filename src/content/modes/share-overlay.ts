import { EXPR } from '../state';
import { createButton } from '../ui/buttons';
import { downloadHook } from '../download/download-hook';

export const createShareOverlayMode = () => (item) => {
	const input = item.querySelector('input[value*="/video/"]');
	item.setAttribute('is-downloadable', 'true');

	if (!input) return;

	const matches = EXPR.vanillaVideoUrl(input.getAttribute('value'));

	if (matches) {
		const [, username, videoId] = matches;
		const button = createButton.BASIC_PLAYER();

		item.prepend(button);

		button.classList.add('share');
		const buttonLink = button.querySelector('a');
		buttonLink.ttdbItem = item;
		buttonLink.parentNode.style.display = 'block';

		setTimeout(() => buttonLink.style.opacity = '1', 50);

		downloadHook(buttonLink, {
			id: videoId,
			videoApiId: videoId,
			user: username,
			url: ''
		});
	}
};

