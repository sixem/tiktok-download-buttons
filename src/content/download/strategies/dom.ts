// Download strategy: DOM.
//
// Used when we resolved a direct HTTP(S) video URL from a <video> element in the DOM.

import type { DownloadContext } from '@/content/download/flow/download-coordinator';
import { startDownload } from '@/content/download/flow/download-coordinator';

export const downloadViaDom = (
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
		sourceTag: 'DOM'
	});
};
