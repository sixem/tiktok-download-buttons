// Legacy compatibility wrapper.
//
// `download-file.ts` used to contain all download logic. It has been split into:
// - `download-coordinator.ts`: cross-cutting mechanics (toasts, SW messaging, browser quirks)
// - `download/strategies/*`: explicit download methods (API / DOM / INTERCEPT / BLOB)
//
// Keeping this wrapper avoids having to update every caller at once.

import type { DownloadContext } from './download-coordinator';
import { downloadWithMethodTag } from './download-coordinator';
import { getMethodTagFromSource } from './download-method';

export { downloadViaApi } from './strategies/api';
export { downloadViaDom } from './strategies/dom';
export { downloadViaIntercept } from './strategies/intercept';
export { downloadViaBlob } from './strategies/blob';

export const downloadFile = (
	url: string,
	filename: string,
	buttonElement: HTMLElement | null = null,
	attemptId: string | number | null = null,
	context: DownloadContext | null = null
) => {
	const source = context?.source ? String(context.source) : null;

	return downloadWithMethodTag({
		url,
		filename,
		buttonElement,
		attemptId,
		context,
		methodTag: getMethodTagFromSource(source)
	});
};
