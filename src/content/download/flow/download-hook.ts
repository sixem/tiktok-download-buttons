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
	}

	if (!button.hasListener) {
		button.addEventListener('click', createDownloadClickHandler(button, videoData));
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
