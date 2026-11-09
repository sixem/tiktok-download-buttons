// Download strategy: INTERCEPT.
//
// Used when we got a signed URL from the preview URL cache (PerformanceObserver/resource timing).

import type { DownloadContext } from '@/content/download/flow/download-coordinator';
import { startDownload } from '@/content/download/flow/download-coordinator';

export const downloadViaIntercept = (
	url: string,
	filename: string,
	buttonElement: HTMLElement | null = null,
	attemptId: string | number | null = null,
	context: DownloadContext | null = null
) => {
	return startDownload({
		url,
		filename,
		buttonElement,
		attemptId,
		context,
		sourceTag: 'INTERCEPT'
	});
};
