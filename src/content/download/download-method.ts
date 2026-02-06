// Download method + source helpers.
//
// This module exists to make our "download method" terminology explicit:
// - **Source**: where we *found* the URL (API / DOM / INTERCEPT / BLOB).
// - **Method tag**: what we show on the toast once the download completes/fails.
//
// The coordinator (`download-coordinator.ts`) uses these helpers for consistent UI messaging.

export type DownloadMethodTag = 'API' | 'DOM' | 'INTERCEPT' | 'BLOB';

export const getMethodTagFromSource = (source: string | null): DownloadMethodTag | null => {
	switch (source) {
		case 'web-api':
		case 'item-detail-api':
			return 'API';
		case 'dom':
			return 'DOM';
		case 'preview-cache':
			return 'INTERCEPT';
		case 'dom-blob':
			return 'BLOB';
		default:
			return null;
	}
};
