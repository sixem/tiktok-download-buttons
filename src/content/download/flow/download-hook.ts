// Download button setup.
//
// Click-time resolution lives in `download-click-handler.ts`; hover-preview
// readiness lives in `preview-button-interactivity.ts`. This module only applies
// stable button attributes and wires those pieces together.
import { DOM } from '@/content/core/dom';
import { createDownloadClickHandler } from '@/content/download/flow/download-click-handler';
import { setupPreviewButtonInteractivity } from '@/content/download/flow/preview-button-interactivity';
import type { ItemVideoData } from '@/types';

export const downloadHook = async (button: HTMLElement, videoData: ItemVideoData) => {
	// Browser-mode controls can survive navigation to a different post. Keep the
	// current data on the button instead of closing over the first post forever.
	button.ttdbVideoData = videoData;
	const videoIdentifier = videoData.id ? videoData.id : Date.now();
	const fileName = `${videoData.user ? `${videoData.user} - ` : ''}${videoIdentifier}`;

	DOM.setAttributes(button, {
		filename: `${fileName.trim()}.mp4`
	});

	if (videoData.videoApiId) {
		button.setAttribute('video-id', videoData.videoApiId);
		setupPreviewButtonInteractivity({
			button,
			videoApiId: videoData.videoApiId
		});
	} else {
		button.removeAttribute('video-id');
	}
	if (videoData.pageUrl) button.setAttribute('data-video-page-url', videoData.pageUrl);
	else button.removeAttribute('data-video-page-url');

	if (!button.hasListener) {
		button.addEventListener('click', (event) => {
			if (button.ttdbVideoData) void createDownloadClickHandler(button, button.ttdbVideoData)(event);
		});
		button.hasListener = true;
	}

	// Default behavior: buttons are interactive once wired.
	// Some grid cards override this temporarily via the hover-preview logic above.
	if (!button.ttdbInteractivityManaged) {
		DOM.setStyle(button, {
			cursor: 'pointer',
			'pointer-events': 'auto'
		});
	}

	return button;
};
