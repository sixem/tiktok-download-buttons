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

const AUTOPLAY_ITEM_ROOT_SELECTOR = [
	'article[data-e2e="recommend-list-item-container"]',
	'article[id^="one-column-item-"]',
	'div.video-feed-item',
	'div.feed-item-content',
	'div.video-card-big.browse-mode',
	'div[class*="-DivBrowserModeContainer"]',
	'div[class*="-DivItemContainer"]',
	'[is-downloadable]'
].join(', ');

export const findVideoIdForVideoElement = (videoEl: HTMLVideoElement) => {
	// Scope the lookup to the video card that owns this media element.
	// During fast feed scrolling, a new article can start playing before TTDB has
	// injected its button. A loose ancestor walk can then reach the feed container
	// and accidentally grab the previous or next article's button.
	const itemRoot = videoEl.closest(AUTOPLAY_ITEM_ROOT_SELECTOR);
	if (!itemRoot) return null;

	const button = itemRoot.querySelector(AUTOPLAY_PREVIEW.buttonSelector) as Element | null;
	const id = button?.getAttribute?.('video-id') || null;
	if (id) return id;

	return null;
};

export const setupAutoplayPreviewCapture = () => {
	if (TTDB.autoplayPreviewCaptureInstalled) return;
	TTDB.autoplayPreviewCaptureInstalled = true;

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
