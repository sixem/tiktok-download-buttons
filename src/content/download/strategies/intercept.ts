// Download strategy: INTERCEPT.
//
// Used when we got a signed URL from the preview URL cache (PerformanceObserver/resource timing).

import type { DownloadContext } from '@/content/download/flow/download-coordinator';
import { downloadWithMethodTag } from '@/content/download/flow/download-coordinator';

export const downloadViaIntercept = (
	url: string,
	filename: string,
	buttonElement: HTMLElement | null = null,
	attemptId: string | number | null = null,
	context: DownloadContext | null = null
) => {
	return downloadWithMethodTag({
		url,
		filename,
		buttonElement,
		attemptId,
		context,
		methodTag: 'INTERCEPT'
	});
};
