import { describe, expect, it, vi } from 'vitest';
import {
	createBatchSession,
	createImageBatchStore,
	handleBatchTimeout,
	handleDownloadStatus,
	notifyBatchSlotWaiters,
	waitForBatchSlot
} from '@/content/download/batch/session-store';

describe('image batch session store', () => {
	it('waits for a batch slot and resolves when pending downloads drop below the cap', async () => {
		const store = createImageBatchStore();
		const batch = createBatchSession('batch-1', 2);
		batch.pendingItemIds.add(101);
		store.activeBatches.set(batch.id, batch);

		let resolved = false;
		const promise = waitForBatchSlot(store, batch.id, batch, 1).then(() => {
			resolved = true;
		});

		await Promise.resolve();
		expect(resolved).toBe(false);
		expect(store.batchSlotWaiters.get(batch.id)?.size).toBe(1);

		batch.pendingItemIds.delete(101);
		notifyBatchSlotWaiters(store, batch.id);
		await promise;

		expect(resolved).toBe(true);
		expect(store.batchSlotWaiters.get(batch.id)?.size).toBe(0);
	});

	it('marks unresolved pending downloads as failed when a batch times out', () => {
		const store = createImageBatchStore();
		const batch = createBatchSession('batch-timeout', 2);
		const onFinal = vi.fn();
		const waiter = vi.fn();

		batch.pendingItemIds.add(201);
		batch.pendingItemIds.add(202);
		store.activeBatches.set(batch.id, batch);
		store.itemToBatch.set(201, batch.id);
		store.itemToBatch.set(202, batch.id);
		store.batchSlotWaiters.set(batch.id, new Set([waiter]));

		const handled = handleBatchTimeout(store, batch.id, { onFinal });

		expect(handled).toBe(true);
		expect(batch.failed).toBe(2);
		expect(batch.completed).toBe(0);
		expect(batch.launchComplete).toBe(true);
		expect(batch.pendingItemIds.size).toBe(0);
		expect(store.itemToBatch.size).toBe(0);
		expect(waiter).toHaveBeenCalledTimes(1);
		expect(onFinal).toHaveBeenCalledWith(batch);
		expect(store.activeBatches.has(batch.id)).toBe(false);
		expect(store.batchSlotWaiters.has(batch.id)).toBe(false);
	});

	it('updates complete/error statuses and finalizes after the last pending item settles', () => {
		const store = createImageBatchStore();
		const batch = createBatchSession('batch-status', 2);
		const onProgress = vi.fn();
		const onFinal = vi.fn();

		batch.launchComplete = true;
		batch.pendingItemIds.add(301);
		batch.pendingItemIds.add(302);
		store.activeBatches.set(batch.id, batch);
		store.itemToBatch.set(301, batch.id);
		store.itemToBatch.set(302, batch.id);

		expect(handleDownloadStatus(store, {
			task: 'downloadStatus',
			itemId: 301,
			state: 'complete'
		}, { onProgress, onFinal })).toBe(true);

		expect(batch.completed).toBe(1);
		expect(batch.failed).toBe(0);
		expect(batch.pendingItemIds.has(301)).toBe(false);
		expect(onProgress).toHaveBeenCalledWith(batch);
		expect(onFinal).not.toHaveBeenCalled();

		expect(handleDownloadStatus(store, {
			task: 'downloadStatus',
			itemId: 302,
			state: 'error'
		}, { onProgress, onFinal })).toBe(true);

		expect(batch.completed).toBe(1);
		expect(batch.failed).toBe(1);
		expect(batch.pendingItemIds.size).toBe(0);
		expect(onFinal).toHaveBeenCalledWith(batch);
		expect(store.activeBatches.has(batch.id)).toBe(false);
		expect(store.itemToBatch.size).toBe(0);
	});
});
