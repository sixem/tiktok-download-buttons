// Download strategy: BLOB.
//
// Used when we only have a blob: URL available (Chromium-only best-effort),
// or when we fall back to an in-page fetch -> blob download.

import type { DownloadContext } from '../download-coordinator';
import { downloadWithMethodTag } from '../download-coordinator';

export const downloadViaBlob = (
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
		methodTag: 'BLOB'
	});
};

