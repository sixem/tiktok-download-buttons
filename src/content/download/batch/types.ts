// Shared types for image batch downloads.
//
// Keeping these contracts small lets the runner, session store, filename helpers,
// and toast presenter evolve independently without reintroducing one large module.

export type {
	DownloadableImageAsset,
	DownloadImageBatchArgs,
	DownloadStartResponse,
	DownloadStatusMessage,
	DownloadLogger as ImageBatchLogger
} from '@/types';

export type BatchSession = {
	id: string;
	toastId: string;
	total: number;
	completed: number;
	failed: number;
	launchComplete: boolean;
	pendingItemIds: Set<number>;
	timeoutId: number | null;
};
