// Network validation helpers for download responses.
import { UTIL } from '@/content/core/state';

export const setupNetworkUtils = () => {
	// Confirm a response looks like a usable video payload.
	UTIL.validateVideoRequest = (t) => {
		const contentType = t.headers.get('Content-Type') || '';

		return t.ok && (contentType.includes('video/')
				|| contentType.includes('application/octet-stream'))
				&& +t.headers.get('Content-Length') > 1000;
	};
};
