// Session store and queue mechanics for image batch downloads.
//
// This module owns in-flight batch state, item-id mapping, capacity waiters, and
// terminal status handling. The runner decides when to launch downloads; this
// store decides when slots open and when a batch has settled.

import type { BatchSession } from '@/content/download/batch/types';
import type { DownloadStatusMessage } from '@/types';

export type ImageBatchStore = {
	activeBatches: Map<string, BatchSession>;
	itemToBatch: Map<number, string>;
	batchSlotWaiters: Map<string, Set<() => void>>;
};

export type StatusHandlers = {
	onProgress?: (batch: BatchSession) => void;
	onFinal?: (batch: BatchSession) => void;
};

type ImageBatchGlobalState = typeof globalThis & {
	__ttdbImageDownloadBatches?: Map<string, BatchSession>;
	__ttdbImageDownloadItemToBatch?: Map<number, string>;
	__ttdbImageDownloadBatchSlotWaiters?: Map<string, Set<() => void>>;
	__ttdbImageDownloadStatusListenerInstalled?: boolean;
};

const globalState = globalThis as ImageBatchGlobalState;

export const createImageBatchStore = (): ImageBatchStore => ({
	activeBatches: new Map(),
	itemToBatch: new Map(),
	batchSlotWaiters: new Map()
});

// These maps are intentionally stored on `globalThis` so hot reload/content reinjection
// can reuse in-flight state instead of losing progress bookkeeping.
export const imageBatchStore: ImageBatchStore = {
	activeBatches: globalState.__ttdbImageDownloadBatches || new Map(),
	itemToBatch: globalState.__ttdbImageDownloadItemToBatch || new Map(),
	batchSlotWaiters: globalState.__ttdbImageDownloadBatchSlotWaiters || new Map()
};

globalState.__ttdbImageDownloadBatches = imageBatchStore.activeBatches;
globalState.__ttdbImageDownloadItemToBatch = imageBatchStore.itemToBatch;
globalState.__ttdbImageDownloadBatchSlotWaiters = imageBatchStore.batchSlotWaiters;

export const createBatchSession = (batchId: string, total: number): BatchSession => ({
	id: batchId,
	toastId: batchId,
	total,
	completed: 0,
	failed: 0,
	launchComplete: false,
	pendingItemIds: new Set(),
	timeoutId: null
});

export const getDoneCount = (batch: BatchSession) => batch.completed + batch.failed;

export const isBatchSettled = (batch: BatchSession) => {
	return batch.launchComplete && batch.pendingItemIds.size === 0 && getDoneCount(batch) >= batch.total;
};

export const isDownloadStatusMessage = (data: unknown): data is DownloadStatusMessage => {
	if (!data || typeof data !== 'object') return false;
	const message = data as Partial<DownloadStatusMessage>;
	return message.task === 'downloadStatus' && typeof message.itemId === 'number' && typeof message.state === 'string';
};

export const notifyBatchSlotWaiters = (store: ImageBatchStore, batchId: string) => {
	const waiters = store.batchSlotWaiters.get(batchId);
	if (!waiters || waiters.size === 0) return;

	const callbacks = [...waiters];
	waiters.clear();
	callbacks.forEach((callback) => {
		callback();
	});
};

export const waitForBatchSlot = (
	store: ImageBatchStore,
	batchId: string,
	batch: BatchSession,
	maxActive: number
) => {
	if (!store.activeBatches.has(batchId)) {
		return Promise.resolve();
	}

	if (batch.pendingItemIds.size < maxActive) {
		return Promise.resolve();
	}

	return new Promise<void>((resolve) => {
		const waiters = store.batchSlotWaiters.get(batchId) || new Set<() => void>();
		const tryResolve = () => {
			// Resolve when either:
			// - this batch has free capacity, or
			// - batch session is gone (cancelled/finalized)
			if (!store.activeBatches.has(batchId) || batch.pendingItemIds.size < maxActive) {
				waiters.delete(tryResolve);
				resolve();
			}
		};

		waiters.add(tryResolve);
		store.batchSlotWaiters.set(batchId, waiters);
	});
};

export const finalizeBatchIfReady = (
	store: ImageBatchStore,
	batchId: string,
	onFinal?: (batch: BatchSession) => void
) => {
	const batch = store.activeBatches.get(batchId);
	if (!batch || !isBatchSettled(batch)) return false;

	if (typeof batch.timeoutId === 'number') {
		clearTimeout(batch.timeoutId);
	}

	onFinal?.(batch);
	store.activeBatches.delete(batchId);
	store.batchSlotWaiters.delete(batchId);
	return true;
};

export const handleBatchTimeout = (
	store: ImageBatchStore,
	batchId: string,
	handlers: StatusHandlers = {}
) => {
	const liveBatch = store.activeBatches.get(batchId);
	if (!liveBatch) return false;

	if (liveBatch.pendingItemIds.size > 0) {
		const unresolved = liveBatch.pendingItemIds.size;
		liveBatch.failed += unresolved;
		liveBatch.pendingItemIds.forEach((itemId) => {
			store.itemToBatch.delete(itemId);
		});
		liveBatch.pendingItemIds.clear();
		notifyBatchSlotWaiters(store, batchId);
	}

	liveBatch.launchComplete = true;
	finalizeBatchIfReady(store, batchId, handlers.onFinal);
	return true;
};

export const handleDownloadStatus = (
	store: ImageBatchStore,
	data: unknown,
	handlers: StatusHandlers = {}
) => {
	if (!isDownloadStatusMessage(data)) return false;
	const itemId = data.itemId;

	const batchId = store.itemToBatch.get(itemId);
	if (!batchId) return false;

	store.itemToBatch.delete(itemId);

	const batch = store.activeBatches.get(batchId);
	if (!batch) return false;

	batch.pendingItemIds.delete(itemId);
	notifyBatchSlotWaiters(store, batchId);

	if (data.state === 'complete') {
		batch.completed += 1;
	} else if (data.state === 'error') {
		batch.failed += 1;
	}

	if (!isBatchSettled(batch)) {
		handlers.onProgress?.(batch);
	}

	finalizeBatchIfReady(store, batchId, handlers.onFinal);
	return true;
};

export const ensureImageBatchStatusListener = (
	store: ImageBatchStore = imageBatchStore,
	handlers: StatusHandlers = {}
) => {
	if (globalState.__ttdbImageDownloadStatusListenerInstalled) return;
	globalState.__ttdbImageDownloadStatusListenerInstalled = true;

	chrome.runtime.onMessage.addListener((data) => {
		handleDownloadStatus(store, data, handlers);
	});
};
