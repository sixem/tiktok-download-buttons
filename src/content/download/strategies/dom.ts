// Download strategy: DOM.
//
// Used when we resolved a direct HTTP(S) video URL from a <video> element in the DOM.

import type { DownloadContext } from '../download-coordinator';
import { downloadWithMethodTag } from '../download-coordinator';

export const downloadViaDom = (
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
		methodTag: 'DOM'
	});
};

