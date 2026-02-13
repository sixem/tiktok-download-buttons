// Shared slideshow launcher primitive.
//
// Feed and browser modes use identical slideshow button behavior:
// - prevent card click bubbling
// - collect image URLs
// - log visibility/debug context
// - open the slideshow picker

import { pipe } from '../../logging';
import { openSlideshowPicker } from '../../slideshow/picker';

type AttachSlideshowLauncherArgs = {
	button: HTMLElement;
	root: ParentNode;
	collectUrls: (root: ParentNode) => string[];
	pickerPrefix: string;
	logNs: string;
};

const logNsMessage = (logNs: string, ...args: unknown[]) => {
	pipe(`[${logNs}]`, ...args);
};

export const attachSlideshowLauncher = ({
	button,
	root,
	collectUrls,
	pickerPrefix,
	logNs
}: AttachSlideshowLauncherArgs) => {
	if (button.ttHasSlideshowPickerLauncher) return;

	button.ttHasSlideshowPickerLauncher = true;
	button.setAttribute('data-ttdb-content-type', 'slideshow');

	button.addEventListener('click', (e) => {
		// Browser mode can reuse the same button across content changes (video <-> slideshow).
		// Keep this listener inert unless slideshow mode is currently active.
		if (button.getAttribute('data-ttdb-content-type') !== 'slideshow') {
			return;
		}

		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation?.();

		const imageUrls = collectUrls(root);
		if (!imageUrls.length) {
			logNsMessage(logNs, 'Slideshow button clicked, but no image URLs were found.');
			return;
		}

		logNsMessage(logNs, 'Slideshow image URLs', {
			count: imageUrls.length,
			urls: imageUrls
		});

		openSlideshowPicker({
			imageUrls,
			assetIdPrefix: pickerPrefix
		});
	});
};
