// Delay before revoking in-page fallback blob URLs after the anchor click is triggered.
export const IN_PAGE_FETCH = {
	blobRevokeDelayMs: 60_000
};

// Bounds for pending download session bookkeeping in the content script.
export const PENDING_DOWNLOAD = {
	maxSessions: 400,
	sessionTtlMs: 6 * 60 * 60 * 1000 // 6 hours
};

// Cache sizing and expiry for captured preview MP4 URLs.
export const PREVIEW_CACHE = {
	maxEntries: 200,
	cacheTtlMs: 10 * 60 * 1000,
	defaultCaptureWindowMs: 1500,
	expirySafetyBufferMs: 12_000
};

// Click-time preview capture / wait timings for video downloads.
export const DOWNLOAD_HOOK = {
	maxAttemptKeys: 800,
	previewWaitMs: 1600,
	previewCaptureWindowMs: 1800
};

// Concurrency, filename defaults, and toast tagging for image batch downloads.
export const IMAGE_BATCH = {
	maxActiveDownloads: 2,
	maxWaitMs: 8 * 60 * 1000,
	defaultBasename: 'image',
	defaultExtension: 'jpg',
	maxBasenameLength: 180,
	toastTag: 'IMG'
};

// Selector and timing used by autoplay-driven preview capture.
export const AUTOPLAY_PREVIEW = {
	lookbackMs: 60_000,
	captureWindowMs: 1800,
	buttonSelector: [
		'a.ttdb__button_feed[video-id]',
		'a.ttdb__button_grid[video-id]',
		'a.ttdb__button_browser[video-id]',
		'a.ttdb__button_basic-player[video-id]'
	].join(', ')
};
