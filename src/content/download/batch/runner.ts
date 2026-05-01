// Runner for slideshow/image batch downloads.
//
// This coordinates asset normalization, subfolder resolution, rolling queue launch,
// and timeout setup. State mutation and status handling stay in `session-store.ts`.

import { TTDB } from '@/content/core/state';
import { IMAGE_BATCH } from '@/content/download/constants';
import {
	getStoredSetting,
	normalizeAssetList,
	sendRuntimeMessage
} from '@/content/utils';
import { imageBatchFilenameHelpers } from '@/content/download/batch/filename';
import {
	createBatchSession,
	ensureImageBatchStatusListener,
	finalizeBatchIfReady,
	handleBatchTimeout,
	imageBatchStore,
	isBatchSettled,
	waitForBatchSlot
} from '@/content/download/batch/session-store';
import {
	renderFinalToast,
	renderProgressToast,
	showNoImagesSelectedToast
} from '@/content/download/batch/toast-presenter';
import type { BatchSession } from '@/content/download/batch/types';
import type {
	DownloadableImageAsset,
	DownloadImageBatchArgs,
	DownloadLogger,
	DownloadStartResponse
} from '@/types';

const getLogger = (): DownloadLogger => {
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

const normalizeAssets = (assets: DownloadableImageAsset[]) => {
	return normalizeAssetList(assets, {
		allowDataUrls: false
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
	logDownload: DownloadLogger;
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

	const filename = imageBatchFilenameHelpers.buildFilename(index, total, asset.url);

	try {
		const rawResponse = await sendRuntimeMessage({
			task: 'fileDownload',
			url: asset.url,
			filename,
			subFolder
		});
		const response = (rawResponse || null) as DownloadStartResponse | null;

		if (response?.success && typeof response.itemId === 'number') {
			imageBatchStore.itemToBatch.set(response.itemId, batchId);
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

const createBatchId = () => `img-batch-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export const downloadImageBatch = async ({
	assets,
	subFolder = null
}: DownloadImageBatchArgs) => {
	ensureImageBatchStatusListener(imageBatchStore, {
		onProgress: renderProgressToast,
		onFinal: renderFinalToast
	});

	const logDownload = getLogger();
	const normalizedAssets = normalizeAssets(assets);

	if (!normalizedAssets.length) {
		showNoImagesSelectedToast();
		return;
	}

	const resolvedSubFolder = await resolveSubFolder(subFolder);
	const batchId = createBatchId();
	const batch = createBatchSession(batchId, normalizedAssets.length);

	imageBatchStore.activeBatches.set(batchId, batch);
	batch.timeoutId = setTimeout(() => {
		handleBatchTimeout(imageBatchStore, batchId, {
			onFinal: renderFinalToast
		});
	}, IMAGE_BATCH.maxWaitMs) as unknown as number;
	renderProgressToast(batch);

	// Rolling queue launcher:
	// start new requests only when active in-browser downloads drop below limit.
	for (let nextIndex = 0; nextIndex < normalizedAssets.length; nextIndex += 1) {
		await waitForBatchSlot(imageBatchStore, batchId, batch, IMAGE_BATCH.maxActiveDownloads);
		if (!imageBatchStore.activeBatches.has(batchId)) break;

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

	finalizeBatchIfReady(imageBatchStore, batchId, renderFinalToast);
};
