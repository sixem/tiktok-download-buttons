// Download status messages emitted by the service worker.

export type DownloadStatusState = 'complete' | 'error';

export type DownloadStatusMessage = {
	task: 'downloadStatus';
	itemId: number;
	state: DownloadStatusState | string;
	error?: unknown;
};

export type DownloadStartResponse = {
	success?: boolean;
	itemId?: number;
	error?: unknown;
};
