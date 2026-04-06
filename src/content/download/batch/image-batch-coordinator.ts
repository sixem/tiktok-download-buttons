// Image batch download coordinator.
//
// This keeps slideshow/image downloads on the same extension path as video downloads:
// - content script requests `fileDownload`
// - service worker returns `itemId`
// - service worker emits `downloadStatus` (complete/error) back to the tab
//
// The coordinator is intentionally small and explicit so behavior is easy to inspect.
import { SPLASH, TTDB } from '@/content/core/state';
import {
	getStoredSetting,
	normalizeAssetList,
	sendRuntimeMessage
} from '@/content/utils';
import { IMAGE_BATCH } from '@/content/download/constants';

type DownloadableImageAsset = {
	id?: string;
	url: string;
	label?: string;
};

type DownloadImageBatchArgs = {
	assets: DownloadableImageAsset[];
	subFolder?: string | null;
};

type BatchSession = {
	id: string;
	toastId: string;
	total: number;
	completed: number;
	failed: number;
	launchComplete: boolean;
	pendingItemIds: Set<number>;
	timeoutId: number | null;
};

type DownloadStartResponse = {
	success?: boolean;
	itemId?: number;
};

type DownloadStatusMessage = {
	task: 'downloadStatus';
	itemId: number;
	state: 'complete' | 'error' | string;
};

const globalState = globalThis as any;

// These maps are intentionally stored on `globalThis` so hot reload/content reinjection
// can reuse in-flight state instead of losing progress bookkeeping.
const activeBatches: Map<string, BatchSession> = globalState.__ttdbImageDownloadBatches || new Map();
const itemToBatch: Map<number, string> = globalState.__ttdbImageDownloadItemToBatch || new Map();
const batchSlotWaiters: Map<string, Set<() => void>> = globalState.__ttdbImageDownloadBatchSlotWaiters || new Map();

globalState.__ttdbImageDownloadBatches = activeBatches;
globalState.__ttdbImageDownloadItemToBatch = itemToBatch;
globalState.__ttdbImageDownloadBatchSlotWaiters = batchSlotWaiters;

const getLogger = () => {
	const loggerFactory = TTDB?.LOG?.ns;
	if (typeof loggerFactory === 'function') {
		return loggerFactory('image-download');
	}

	return {
		info: (...args) => console.info('[image-download]', ...args),
		warn: (...args) => console.warn('[image-download]', ...args),
		error: (...args) => console.error('[image-download]', ...args)
	};
};

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;

const replaceControlCharacters = (value: string) => {
	let sanitized = '';

	for (const char of value) {
		const code = char.charCodeAt(0);
		sanitized += code <= 0x1f ? ' ' : char;
	}

	return sanitized;
};

const sanitizeFilenamePart = (value: string, fallback = IMAGE_BATCH.defaultBasename) => {
	const safe = replaceControlCharacters(String(value || ''))
		.replace(INVALID_FILENAME_CHARS, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^\.+/, '');

	return (safe || fallback).slice(0, IMAGE_BATCH.maxBasenameLength).trim();
};

const sanitizeExtension = (value: string) => {
	const cleaned = String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');

	if (!cleaned) return null;
	return cleaned === 'jpeg' ? 'jpg' : cleaned;
};

const normalizeAssets = (assets: DownloadableImageAsset[]) => {
	return normalizeAssetList(assets, {
		allowDataUrls: false
	});
};

const getImageExtension = (url: string) => {
	try {
		const parsed = new URL(url);
		const path = parsed.pathname || '';
		const match = /\.([a-z0-9]{1,8})$/i.exec(path);
		if (!match) return IMAGE_BATCH.defaultExtension;
		return sanitizeExtension(match[1]) || IMAGE_BATCH.defaultExtension;
	} catch (_) {
		return IMAGE_BATCH.defaultExtension;
	}
};

const getFilenamePartsFromUrl = (url: string) => {
	try {
		const parsed = new URL(url);
		const rawPath = parsed.pathname || '';
		const pathParts = rawPath.split('/').filter(Boolean);
		const lastSegment = pathParts[pathParts.length - 1] || '';
		const decodedLastSegment = decodeURIComponent(lastSegment).trim();
		if (!decodedLastSegment) {
			return null;
		}

		const dotIndex = decodedLastSegment.lastIndexOf('.');
		if (dotIndex <= 0 || dotIndex >= decodedLastSegment.length - 1) {
			return {
				baseName: sanitizeFilenamePart(decodedLastSegment),
				extension: getImageExtension(url)
			};
		}

		const rawBaseName = decodedLastSegment.slice(0, dotIndex);
		const rawExtension = decodedLastSegment.slice(dotIndex + 1);
		return {
			baseName: sanitizeFilenamePart(rawBaseName),
			extension: sanitizeExtension(rawExtension) || getImageExtension(url)
		};
	} catch (_) {
		return null;
	}
};

// Keep source names recognizable:
// - decode URL pathname segments
// - preserve extension when possible
// - append order suffix only for multi-item downloads
const buildFilename = (index: number, total: number, url: string) => {
	const parsedFilename = getFilenamePartsFromUrl(url);
	const baseName = parsedFilename?.baseName || IMAGE_BATCH.defaultBasename;
	const extension = parsedFilename?.extension || getImageExtension(url);
	if (total <= 1) {
		return `${baseName}.${extension}`;
	}

	const padLength = Math.max(2, String(total).length);
	const sequence = String(index + 1).padStart(padLength, '0');
	return `${baseName}-${sequence}.${extension}`;
};

// Export the filename helpers so the normalization rules stay easy to test in isolation.
export const imageBatchFilenameHelpers = {
	replaceControlCharacters,
	sanitizeFilenamePart,
	getImageExtension,
	getFilenamePartsFromUrl,
	buildFilename
};

const getDoneCount = (batch: BatchSession) => batch.completed + batch.failed;

const isBatchSettled = (batch: BatchSession) => {
	return batch.launchComplete && batch.pendingItemIds.size === 0 && getDoneCount(batch) >= batch.total;
};

const isDownloadStatusMessage = (data: unknown): data is DownloadStatusMessage => {
	if (!data || typeof data !== 'object') return false;
	const message = data as Partial<DownloadStatusMessage>;
	return message.task === 'downloadStatus' && typeof message.itemId === 'number' && typeof message.state === 'string';
};

const notifyBatchSlotWaiters = (batchId: string) => {
	const waiters = batchSlotWaiters.get(batchId);
	if (!waiters || waiters.size === 0) return;

	const callbacks = [...waiters];
	waiters.clear();
	callbacks.forEach((callback) => {
		callback();
	});
};

const waitForBatchSlot = (batchId: string, batch: BatchSession, maxActive: number) => {
	if (!activeBatches.has(batchId)) {
		return Promise.resolve();
	}

	if (batch.pendingItemIds.size < maxActive) {
		return Promise.resolve();
	}

	return new Promise<void>((resolve) => {
		const waiters = batchSlotWaiters.get(batchId) || new Set<() => void>();
		const tryResolve = () => {
			// Resolve when either:
			// - this batch has free capacity, or
			// - batch session is gone (cancelled/finalized)
			if (!activeBatches.has(batchId) || batch.pendingItemIds.size < maxActive) {
				waiters.delete(tryResolve);
				resolve();
			}
		};

		waiters.add(tryResolve);
		batchSlotWaiters.set(batchId, waiters);
	});
};

const renderProgressToast = (batch: BatchSession) => {
	if (!SPLASH || typeof SPLASH.message !== 'function') return;

	const done = getDoneCount(batch);
	const remaining = Math.max(batch.total - done, 0);
	SPLASH.message({
		title: 'Downloading images',
		detail: `${done}/${batch.total} completed`,
		meta: `Failed: ${batch.failed} | Remaining: ${remaining}`
	}, {
		id: batch.toastId,
		state: 0,
		sticky: true,
		spinner: true,
		hideMeta: false,
		tag: null
	});
};

const renderFinalToast = (batch: BatchSession) => {
	if (!SPLASH || typeof SPLASH.message !== 'function') return;

	if (batch.failed === 0) {
		SPLASH.message({
			title: 'Images downloaded',
			detail: `${batch.completed}/${batch.total} completed`
		}, {
			id: batch.toastId,
			state: 1,
			sticky: false,
			spinner: false,
			duration: 5000,
			hideMeta: true,
			tag: IMAGE_BATCH.toastTag
		});
		return;
	}

	if (batch.completed > 0) {
		SPLASH.message({
			title: 'Image batch finished',
			detail: `${batch.completed}/${batch.total} completed`,
			meta: `${batch.failed} failed`
		}, {
			id: batch.toastId,
			state: 2,
			sticky: false,
			spinner: false,
			duration: 6000,
			hideMeta: false,
			tag: IMAGE_BATCH.toastTag
		});
		return;
	}

	SPLASH.message({
		title: 'Image download failed',
		detail: 'No selected images could be downloaded.'
	}, {
		id: batch.toastId,
		state: 3,
		sticky: false,
		spinner: false,
		duration: 6500,
		hideMeta: true,
		tag: IMAGE_BATCH.toastTag
	});
};

const finalizeBatchIfReady = (batchId: string) => {
	const batch = activeBatches.get(batchId);
	if (!batch || !isBatchSettled(batch)) return;

	if (typeof batch.timeoutId === 'number') {
		clearTimeout(batch.timeoutId);
	}

	renderFinalToast(batch);
	activeBatches.delete(batchId);
	batchSlotWaiters.delete(batchId);
};

const ensureStatusListener = () => {
	if (globalState.__ttdbImageDownloadStatusListenerInstalled) return;
	globalState.__ttdbImageDownloadStatusListenerInstalled = true;

	chrome.runtime.onMessage.addListener((data) => {
		if (!isDownloadStatusMessage(data)) return;
		const itemId = data.itemId;

		const batchId = itemToBatch.get(itemId);
		if (!batchId) return;

		itemToBatch.delete(itemId);

		const batch = activeBatches.get(batchId);
		if (!batch) return;

		batch.pendingItemIds.delete(itemId);
		notifyBatchSlotWaiters(batchId);

		if (data.state === 'complete') {
			batch.completed += 1;
		} else if (data.state === 'error') {
			batch.failed += 1;
		}

		if (!isBatchSettled(batch)) {
			renderProgressToast(batch);
		}

		finalizeBatchIfReady(batchId);
	});
};

const resolveSubFolder = async (provided?: string | null) => {
	if (typeof provided === 'string') {
		return provided.trim();
	}

	const stored = await getStoredSetting('download-subfolder-path');
	return typeof stored === 'string' ? stored.trim() : '';
};

const startSingleImageDownload = async (args: {
	batchId: string;
	batch: BatchSession;
	total: number;
	index: number;
	asset: DownloadableImageAsset;
	subFolder: string;
	logDownload: ReturnType<typeof getLogger>;
}) => {
	const {
		batchId,
		batch,
		total,
		index,
		asset,
		subFolder,
		logDownload
	} = args;

	const filename = buildFilename(index, total, asset.url);

	try {
		const rawResponse = await sendRuntimeMessage({
			task: 'fileDownload',
			url: asset.url,
			filename,
			subFolder
		});
		const response = (rawResponse || null) as DownloadStartResponse | null;

		if (response?.success && typeof response.itemId === 'number') {
			itemToBatch.set(response.itemId, batchId);
			batch.pendingItemIds.add(response.itemId);
			logDownload.info('image download started', {
				itemId: response.itemId,
				filename,
				url: asset.url
			});
			return;
		}

		batch.failed += 1;
		logDownload.warn('image download failed to start', {
			filename,
			url: asset.url,
			response
		});
	} catch (error) {
		batch.failed += 1;
		logDownload.warn('image download request error', {
			filename,
			url: asset.url,
			error
		});
	}
};

export const downloadImageBatch = async ({
	assets,
	subFolder = null
}: DownloadImageBatchArgs) => {
	ensureStatusListener();

	const logDownload = getLogger();
	const normalizedAssets = normalizeAssets(assets);

	if (!normalizedAssets.length) {
		SPLASH?.message?.({
			title: 'No images selected',
			detail: 'Choose at least one image to download.'
		}, {
			state: 2,
			duration: 3600,
			hideMeta: true,
			tag: IMAGE_BATCH.toastTag
		});
		return;
	}

	const resolvedSubFolder = await resolveSubFolder(subFolder);
	const batchId = `img-batch-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
	const batch: BatchSession = {
		id: batchId,
		toastId: batchId,
		total: normalizedAssets.length,
		completed: 0,
		failed: 0,
		launchComplete: false,
		pendingItemIds: new Set(),
		timeoutId: null
	};

	activeBatches.set(batchId, batch);
	batch.timeoutId = setTimeout(() => {
		const liveBatch = activeBatches.get(batchId);
		if (!liveBatch) return;

		if (liveBatch.pendingItemIds.size > 0) {
			const unresolved = liveBatch.pendingItemIds.size;
			liveBatch.failed += unresolved;
			liveBatch.pendingItemIds.forEach((itemId) => {
				itemToBatch.delete(itemId);
			});
			liveBatch.pendingItemIds.clear();
			notifyBatchSlotWaiters(batchId);
		}

		liveBatch.launchComplete = true;
		finalizeBatchIfReady(batchId);
	}, IMAGE_BATCH.maxWaitMs) as unknown as number;
	renderProgressToast(batch);

	// Rolling queue launcher:
	// start new requests only when active in-browser downloads drop below limit.
	for (let nextIndex = 0; nextIndex < normalizedAssets.length; nextIndex += 1) {
		await waitForBatchSlot(batchId, batch, IMAGE_BATCH.maxActiveDownloads);
		if (!activeBatches.has(batchId)) break;

		const entry = normalizedAssets[nextIndex];
		await startSingleImageDownload({
			batchId,
			batch,
			total: normalizedAssets.length,
			index: nextIndex,
			asset: entry,
			subFolder: resolvedSubFolder,
			logDownload
		});

		if (!isBatchSettled(batch)) {
			renderProgressToast(batch);
		}
	}
	batch.launchComplete = true;

	if (!isBatchSettled(batch)) {
		renderProgressToast(batch);
	}

	finalizeBatchIfReady(batchId);
};
