// Runtime message contracts passed between content scripts and the service worker.

export type RuntimeTask = 'fileDownload' | 'fileShow' | 'runtimeInfo';

export type RuntimeInfoResponse = {
	success: boolean;
	isFirefox?: boolean;
	isChromium?: boolean;
	error?: unknown;
};

export type FileDownloadMessage = {
	task: 'fileDownload';
	filename: string;
	url: string;
	subFolder?: string | null;
	referer?: string;
};

export type FileDownloadResponse = {
	success?: boolean;
	itemId?: number;
	error?: unknown;
};
