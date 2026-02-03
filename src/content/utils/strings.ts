// String helpers for display names and filesystem-safe output.
import { UTIL } from '../state';

export const setupStringUtils = () => {
	// Keep strings within a max length without changing short values.
	UTIL.truncateString = (string, n) => {
		return (string.length > n) ? string.slice(0, n - 1) : string;
	};

	// Remove characters and prefixes that are unsafe for filenames.
	UTIL.sanitizeFilename = (string) => {
		string = string.replace(
			/[^\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\wÃÂ°-Ã‘Â0-9a-zA-Z-._ #()\[\]]/g, ''
		).replace(/\s\s+/g, ' ').trim();

		while (string[0] === '.') {
			string = string.substring(1);
		}

		return (string.length - 4) >= 246 ? `${string.replace('.mp4', '').substring(0, 246).trim()}.mp4` : string;
	};
};
