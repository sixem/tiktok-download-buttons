// Image batch download coordinator facade.
//
// This keeps slideshow/image downloads on the same extension path as video downloads:
// - content script requests `fileDownload`
// - service worker returns `itemId`
// - service worker emits terminal `downloadStatus` (complete/error) back to the tab
//
// The implementation is split into focused modules; this file remains the
// stable public import path for callers and tests.
export { imageBatchFilenameHelpers } from './filename';
export { downloadImageBatch } from './runner';
export type {
	DownloadableImageAsset,
	DownloadImageBatchArgs
} from '@/types';
