// Preview-capture hover wiring for buttons that need TikTok's signed preview URL.
//
// Some grid-like cards do not expose a stable video URL until the user hovers the
// card. For those, we temporarily let pointer events pass through the TTDB button
// so TikTok's own preview hover behavior can run first.

import { DOM } from '@/content/core/dom';
import { DOWNLOAD_HOOK } from '@/content/download/constants';
import {
	armPreviewCapture,
	getCachedPreviewUrl,
	waitForPreviewUrl
} from '@/content/download/state/preview-url-cache';

type SetInteractive = (interactive: boolean) => void;

type PreviewReadyArgs = {
	button: HTMLElement;
	videoApiId: string;
	isNoModeCard: boolean;
	previewWaitMs?: number;
	getCachedPreview?: (videoId: string) => string | null;
	waitForPreview?: (videoId: string, timeoutMs: number) => Promise<string | null>;
	setInteractive?: SetInteractive;
};

type SetupPreviewInteractivityArgs = {
	button: HTMLElement;
	videoApiId: string | null | undefined;
};

const setPreviewButtonInteractive = (button: HTMLElement, interactive: boolean) => {
	DOM.setStyle(button, {
		cursor: interactive ? 'pointer' : 'not-allowed',
		'pointer-events': interactive ? 'auto' : 'none'
	});
};

export const ensurePreviewButtonInteractiveWhenReady = ({
	button,
	videoApiId,
	isNoModeCard,
	previewWaitMs = DOWNLOAD_HOOK.previewWaitMs,
	getCachedPreview = getCachedPreviewUrl,
	waitForPreview = waitForPreviewUrl,
	setInteractive = (interactive) => setPreviewButtonInteractive(button, interactive)
}: PreviewReadyArgs) => {
	if (!isNoModeCard) return;
	if (button.ttdbPreviewReady) return;
	if (button.ttdbPreviewReadyPromise) return;

	const cached = getCachedPreview(videoApiId);
	if (cached) {
		button.ttdbPreviewReady = true;
		setInteractive(true);
		return;
	}

	button.ttdbPreviewReadyPromise = waitForPreview(videoApiId, previewWaitMs)
		.then((url) => {
			if (!url) return;
			button.ttdbPreviewReady = true;
			setInteractive(true);
		})
		.finally(() => {
			button.ttdbPreviewReadyPromise = null;
		});
};

export const setupPreviewButtonInteractivity = ({
	button,
	videoApiId
}: SetupPreviewInteractivityArgs) => {
	if (!videoApiId) return false;

	const isGridButton = button.classList.contains('ttdb__button_grid');

	// Arm a preview-capture window when the user hovers the card. This is where TikTok
	// typically requests the signed MP4 URL we can later download.
	const container = button.closest('[is-downloadable]') || button.closest('article');
	if (!container || container.ttdbPreviewCaptureArmed) return false;

	// Newer grid-like cards (e.g. "You may like") do not have `[mode]` and frequently
	// rely on hover previews to expose a usable signed MP4 URL.
	const isNoModeCard = isGridButton && !container.querySelector('[mode]');
	const ensureInteractive = () => {
		ensurePreviewButtonInteractiveWhenReady({
			button,
			videoApiId,
			isNoModeCard
		});
	};

	if (isNoModeCard) {
		// Start in "hover-through" mode so we don't stop the preview playback by accident.
		button.ttdbInteractivityManaged = true;
		setPreviewButtonInteractive(button, false);
		// If we already captured a preview URL earlier (e.g. you hovered before the button
		// was injected), enable immediately.
		ensureInteractive();
	}

	const armHoverCapture = () => {
		armPreviewCapture(videoApiId, 'hover', DOWNLOAD_HOOK.previewWaitMs);
		ensureInteractive();
	};

	container.addEventListener('pointerenter', armHoverCapture, { passive: true });
	container.addEventListener('mouseenter', armHoverCapture, { passive: true });
	container.ttdbPreviewCaptureArmed = true;

	return true;
};
