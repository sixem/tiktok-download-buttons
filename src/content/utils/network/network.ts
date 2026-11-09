// Network validation helpers for download responses.
import { UTIL } from '@/content/core/state';

export const setupNetworkUtils = () => {
	// Confirm a response looks like a usable video payload.
	UTIL.validateVideoRequest = (t) => {
		const contentType = (t.headers.get('Content-Type') || '').toLowerCase();
		const length = t.headers.get('Content-Length');

		return t.ok && (contentType.includes('video/')
				|| contentType.includes('application/octet-stream'))
				&& (length === null || Number(length) > 1000);
	};
};
