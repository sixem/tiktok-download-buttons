// Autoplay preview capture (For You feed).
//
// TikTok often preloads or fetches the signed MP4 URL before a <video> fires `play/playing`.
// When that happens, a forward-looking capture window (hover/click) can miss the request.
//
// This module listens for `play` events and seeds the preview URL cache from a short lookback
// window in ResourceTiming entries, then arms a normal capture window for any follow-up requests.

import { TTDB } from '@/content/core/state';
import { AUTOPLAY_PREVIEW } from '@/content/download/constants';
import { armPreviewCapture, seedPreviewUrlFromLookback } from '@/content/download/state/preview-url-cache';

const findVideoIdForVideoElement = (videoEl: HTMLVideoElement) => {
	// Walk up a few ancestors and look for the TTDB button that holds `video-id`.
	// This keeps the lookup cheap and avoids scanning the whole document.
	let current: any = videoEl as any;
	for (let i = 0; i < 10 && current; i += 1) {
		const el: Element | null = current instanceof Element ? current : null;
		if (el) {
			const button = el.querySelector(AUTOPLAY_PREVIEW.buttonSelector) as Element | null;
			const id = button?.getAttribute?.('video-id') || null;
			if (id) return id;
		}
		current = current.parentElement || current.parentNode;
	}

	return null;
};

export const setupAutoplayPreviewCapture = () => {
	if ((TTDB as any).autoplayPreviewCaptureInstalled) return;
	(TTDB as any).autoplayPreviewCaptureInstalled = true;

	// Capture phase ensures we see the event even if TikTok stops propagation.
	document.addEventListener('play', (event) => {
		const target = event.target;
		if (!(target instanceof HTMLVideoElement)) return;

		const videoId = findVideoIdForVideoElement(target);
		if (!videoId) return;

		// Seed from recent ResourceTiming entries first (helps when the MP4 was fetched before play).
		seedPreviewUrlFromLookback(videoId, {
			lookbackMs: AUTOPLAY_PREVIEW.lookbackMs,
			referencePerfMs: performance.now()
		});

		// Also arm a short forward capture window in case TikTok requests a refreshed URL.
		armPreviewCapture(videoId, 'autoplay', AUTOPLAY_PREVIEW.captureWindowMs);
	}, true);
};
