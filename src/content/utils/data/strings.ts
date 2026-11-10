// String helpers for display names and filesystem-safe output.
import { UTIL } from '@/content/core/state';
import { sanitizeFilename } from '@/content/download/filename';

export const setupStringUtils = () => {
	// Keep strings within a max length without changing short values.
	UTIL.truncateString = (string, n) => {
		return (string.length > n) ? string.slice(0, n - 1) : string;
	};

	UTIL.sanitizeFilename = sanitizeFilename;
};
