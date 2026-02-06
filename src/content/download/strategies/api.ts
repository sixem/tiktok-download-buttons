// Download strategy: API.
//
// Used when we resolved a signed video URL via TikTok's API (web API or item-detail API).

import type { DownloadContext } from '../download-coordinator';
import { downloadWithMethodTag } from '../download-coordinator';

export const downloadViaApi = (
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
		methodTag: 'API'
	});
};

