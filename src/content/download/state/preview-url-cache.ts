// Captures and caches "real" video URLs (HTTP(S)) by observing ResourceTiming entries.
//
// Why this exists:
// - On Firefox, TikTok often serves challenge pages / empty API responses, so we can't reliably
//   resolve an MP4 URL via HTML parsing or the item-detail API.
// - The DOM <video> element frequently uses blob: URLs (MediaSource), which are not reliably
//   downloadable from a content script in Firefox.
//
// Instead, we observe the network URLs TikTok requests for previews (often on hover),
// then associate those URLs with a video-id during a short "capture window".

import { TTDB } from '@/content/core/state';
import { PREVIEW_CACHE } from '@/content/download/constants';

type CaptureReason = 'hover' | 'click' | 'autoplay';

type CaptureWindow = {
	videoId: string;
	reason: CaptureReason;
	armedAtPerfMs: number;
	expiresAtPerfMs: number;
};

type CachedPreviewUrl = {
	url: string;
	capturedAtMs: number;
	expiresAtMs: number;
	expireParamMs?: number;
	initiatorType?: string;
};

// Map preserves insertion order, which we use as our LRU ordering.
const previewUrlCache = new Map<string, CachedPreviewUrl>();
const captureWindows: CaptureWindow[] = [];
const pendingWaiters = new Map<string, Set<(url: string) => void>>();

let observerStarted = false;

const shouldDebug = () => {
	try {
		return !!(TTDB && (TTDB.debug?.previewCache || (globalThis as any).__TTDB_DEBUG_PREVIEW_CACHE));
	} catch (_) {
		return false;
	}
};

const logDebug = (...args: any[]) => {
	if (!shouldDebug()) return;
	try {
		TTDB?.LOG?.ns?.('preview-cache')?.debug?.(...args);
	} catch (_) {
		// Fallback: avoid throwing if LOG isn't ready.
		console.debug('[TTDB]', '[preview-cache]', ...args);
	}
};

const pruneCaptureWindows = (nowPerfMs: number) => {
	// Keep the window list small and remove expired entries.
	for (let i = captureWindows.length - 1; i >= 0; i -= 1) {
		if (captureWindows[i].expiresAtPerfMs <= nowPerfMs) {
			captureWindows.splice(i, 1);
		}
	}

	if (captureWindows.length > 12) {
		captureWindows.splice(0, captureWindows.length - 12);
	}
};

const pruneCache = (nowMs: number) => {
	for (const [videoId, entry] of previewUrlCache.entries()) {
		if (entry.expiresAtMs <= nowMs) {
			previewUrlCache.delete(videoId);
		}
	}
};

const parseExpireParamMs = (rawUrl: string) => {
	if (!rawUrl) return null;

	// TikTok signed CDN URLs frequently include `expire=<unix seconds>`.
	try {
		const url = new URL(rawUrl);
		const expire = url.searchParams.get('expire');
		if (!expire) return null;

		const seconds = Number(expire);
		if (!Number.isFinite(seconds) || seconds <= 0) return null;

		return seconds * 1000;
	} catch (_) {
		return null;
	}
};

const isLikelyVideoResourceUrl = (rawUrl: string) => {
	if (!rawUrl) return false;

	let url: URL | null = null;
	try {
		url = new URL(rawUrl);
	} catch (_) {
		// If URL parsing fails, we still can do a small string-based check.
	}

	const lower = rawUrl.toLowerCase();

	// Ignore known "demo" / login playback media that isn't the hovered post.
	if (lower.includes('playback') && lower.endsWith('.mp4')) return false;
	if (lower.includes('ttwstatic.com')) return false;

	// Require clear video markers. The TikTok CDN URLs we care about usually include these.
	const looksVideo =
		lower.includes('mime_type=video')
		|| lower.includes('video_mp4')
		|| lower.includes('bytevc')
		|| lower.includes('hev1')
		|| lower.includes('hvc1')
		|| lower.includes('.mp4')
		|| lower.includes('.m3u8');

	if (!looksVideo) return false;

	// Be conservative about hostnames. If URL parsing failed, fall back to a string check.
	const host = url?.hostname?.toLowerCase?.() || '';
	const hostLooksValid = host
		? /(tiktokcdn|tiktokv|ibytedtos|tiktok\.com)/i.test(host)
		: /(tiktokcdn|tiktokv|ibytedtos|tiktok\.com)/i.test(lower);

	if (!hostLooksValid) return false;

	return /^https?:/i.test(rawUrl);
};

const resolveWaiters = (videoId: string, url: string) => {
	const waiters = pendingWaiters.get(videoId);
	if (!waiters || !waiters.size) return;

	pendingWaiters.delete(videoId);
	for (const resolve of waiters) {
		try {
			resolve(url);
		} catch (_) {
			// Ignore waiter errors; they are consumer-side.
		}
	}
};

const touchLru = (videoId: string, entry: CachedPreviewUrl) => {
	// Refresh insertion order so the entry stays "hot" in our LRU.
	previewUrlCache.delete(String(videoId));
	previewUrlCache.set(String(videoId), entry);
};

const evictIfNeeded = () => {
	while (previewUrlCache.size > PREVIEW_CACHE.maxEntries) {
		const oldestKey = previewUrlCache.keys().next().value;
		if (!oldestKey) break;
		previewUrlCache.delete(oldestKey);
	}
};

const shouldReplaceEntry = (existing: CachedPreviewUrl | null, incomingExpireMs: number | null) => {
	if (!existing) return true;

	const nowMs = Date.now();
	if (existing.expiresAtMs <= nowMs) return true;

	// Prefer the URL that stays valid longer when we can measure it.
	if (incomingExpireMs && existing.expireParamMs) {
		return incomingExpireMs > existing.expireParamMs;
	}
	if (incomingExpireMs && !existing.expireParamMs) return true;

	// Otherwise, keep the existing (avoid flapping on noisy candidates).
	return false;
};

const storePreviewUrl = (videoId: string, url: string, initiatorType?: string) => {
	const nowMs = Date.now();
	pruneCache(nowMs);

	const expireParamMs = parseExpireParamMs(url);
	const computedExpiryMs = expireParamMs
		? Math.max(nowMs, expireParamMs - PREVIEW_CACHE.expirySafetyBufferMs)
		: nowMs + PREVIEW_CACHE.cacheTtlMs;

	const id = String(videoId);
	const existing = previewUrlCache.get(id) || null;
	if (!shouldReplaceEntry(existing, expireParamMs)) {
		// Still touch the LRU order since we observed this video again.
		if (existing) {
			touchLru(id, existing);
		}
		return;
	}

	const entry: CachedPreviewUrl = {
		url,
		initiatorType,
		capturedAtMs: nowMs,
		expiresAtMs: computedExpiryMs,
		...(expireParamMs ? { expireParamMs } : {})
	};

	touchLru(id, entry);
	evictIfNeeded();

	logDebug('stored', {
		videoId: id,
		initiatorType,
		expiresInMs: entry.expiresAtMs - nowMs,
		hasExpireParam: !!expireParamMs
	});

	resolveWaiters(id, url);
};

const findMatchingWindow = (entryStartPerfMs: number) => {
	// Match to the most recent window that includes this entry.
	for (let i = captureWindows.length - 1; i >= 0; i -= 1) {
		const win = captureWindows[i];
		if (entryStartPerfMs >= win.armedAtPerfMs && entryStartPerfMs <= win.expiresAtPerfMs) {
			return win;
		}
	}
	return null;
};

const recentVideoUrlEvents: Array<{ perfMs: number; url: string; initiatorType?: string }> = [];

const onResourceEntry = (entry: PerformanceEntry) => {
	const asResource: any = entry as any;
	const url = typeof asResource?.name === 'string' ? asResource.name : '';
	if (!isLikelyVideoResourceUrl(url)) return;

	const startTime = typeof asResource?.startTime === 'number' ? asResource.startTime : performance.now();
	const initiatorType = typeof asResource?.initiatorType === 'string' ? asResource.initiatorType : undefined;

	pruneCaptureWindows(performance.now());
	const win = findMatchingWindow(startTime);
	if (!win) return;

	recentVideoUrlEvents.push({ perfMs: performance.now(), url, initiatorType });
	if (recentVideoUrlEvents.length > 12) {
		recentVideoUrlEvents.splice(0, recentVideoUrlEvents.length - 12);
	}

	storePreviewUrl(win.videoId, url, initiatorType);
};

const ensureObserver = () => {
	if (observerStarted) return;
	observerStarted = true;

	if (typeof PerformanceObserver === 'undefined') return;

	try {
		const observer = new PerformanceObserver((list) => {
			const entries = list.getEntries();
			for (const entry of entries) {
				onResourceEntry(entry);
			}
		});

		// Try modern API first; fall back to entryTypes for older implementations.
		// `buffered: true` helps when the observer starts after the first preview request.
		try {
			(observer as any).observe({ type: 'resource', buffered: true });
		} catch (_) {
			observer.observe({ entryTypes: ['resource'] });
		}
	} catch (_) {
		// If the observer cannot be created, we silently disable this cache.
	}
};

export const armPreviewCapture = (
	videoId: string,
	reason: CaptureReason,
	windowMs = PREVIEW_CACHE.defaultCaptureWindowMs
) => {
	if (!videoId) return;

	ensureObserver();

	const nowPerfMs = performance.now();
	pruneCaptureWindows(nowPerfMs);

	// Backdate slightly so we can match resource entries that start at nearly the same moment
	// as the hover/click event (the observer callback can run after the request is already started).
	const backdateMs = 250;
	const armedAt = Math.max(0, nowPerfMs - backdateMs);

	captureWindows.push({
		videoId: String(videoId),
		reason,
		armedAtPerfMs: armedAt,
		expiresAtPerfMs: armedAt + windowMs
	});

	logDebug('armed', { videoId: String(videoId), reason, windowMs });
};

export const getCachedPreviewUrl = (videoId: string) => {
	if (!videoId) return null;

	const nowMs = Date.now();
	pruneCache(nowMs);

	const entry = previewUrlCache.get(String(videoId));
	if (!entry) return null;
	if (entry.expiresAtMs <= nowMs) {
		previewUrlCache.delete(String(videoId));
		return null;
	}

	// Touch the LRU order so frequently-used IDs stay around.
	touchLru(String(videoId), entry);

	return entry.url || null;
};

export const seedPreviewUrlFromLookback = (
	videoId: string,
	{
		lookbackMs = 60_000,
		referencePerfMs = performance.now()
	}: { lookbackMs?: number; referencePerfMs?: number } = {}
) => {
	if (!videoId) return null;

	ensureObserver();

	const entries = performance.getEntriesByType('resource') || [];
	const candidates: Array<{ url: string; initiatorType?: string; responseEnd: number }> = [];

	for (let i = entries.length - 1; i >= 0; i -= 1) {
		const entry: any = entries[i] as any;
		const url = typeof entry?.name === 'string' ? entry.name : '';
		if (!isLikelyVideoResourceUrl(url)) continue;

		const responseEnd = typeof entry?.responseEnd === 'number' ? entry.responseEnd : 0;
		const ageMs = referencePerfMs - responseEnd;
		if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > lookbackMs) continue;

		candidates.push({
			url,
			responseEnd,
			initiatorType: typeof entry?.initiatorType === 'string' ? entry.initiatorType : undefined
		});

		// Don't scan an unbounded number of entries; the most recent ones are the only plausible matches.
		if (candidates.length >= 60) break;
	}

	if (!candidates.length) return null;

	// Pick the most recent candidate. This is the safest choice because the lookback is used
	// in response to an event that just occurred (e.g. play).
	candidates.sort((a, b) => b.responseEnd - a.responseEnd);
	const best = candidates[0];

	storePreviewUrl(String(videoId), best.url, best.initiatorType);
	logDebug('seeded-from-lookback', {
		videoId: String(videoId),
		lookbackMs,
		initiatorType: best.initiatorType
	});

	return best.url;
};

export const waitForPreviewUrl = (videoId: string, timeoutMs: number) => {
	if (!videoId) return Promise.resolve(null);

	const cached = getCachedPreviewUrl(videoId);
	if (cached) return Promise.resolve(cached);

	ensureObserver();

	return new Promise<string | null>((resolve) => {
		const id = String(videoId);

		let waiters = pendingWaiters.get(id);
		if (!waiters) {
			waiters = new Set();
			pendingWaiters.set(id, waiters);
		}

		waiters.add(resolve);

		setTimeout(() => {
			const activeWaiters = pendingWaiters.get(id);
			if (activeWaiters) {
				activeWaiters.delete(resolve);
				if (!activeWaiters.size) {
					pendingWaiters.delete(id);
				}
			}

			logDebug('wait-timeout', {
				videoId: id,
				recentVideoUrls: recentVideoUrlEvents.slice(-6)
			});
			resolve(null);
		}, Math.max(0, timeoutMs || 0));
	});
};
