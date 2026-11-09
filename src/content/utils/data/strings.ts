// String helpers for display names and filesystem-safe output.
import { UTIL } from '@/content/core/state';

export const setupStringUtils = () => {
	// Keep strings within a max length without changing short values.
	UTIL.truncateString = (string, n) => {
		return (string.length > n) ? string.slice(0, n - 1) : string;
	};

	// Remove characters and prefixes that are unsafe for filenames.
	UTIL.sanitizeFilename = (string) => {
		string = Array.from(String(string))
			.filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
			.join('').replace(/[<>:"/\\|?*]/g, '').replace(/\s\s+/g, ' ').trim();

		while (string[0] === '.') {
			string = string.substring(1);
		}

		// Filesystems commonly limit a filename component to 255 bytes, not
		// characters. Truncate by UTF-8 bytes without splitting Unicode characters.
		const encoder = new TextEncoder();
		if (encoder.encode(string).length <= 250) return string;
		const extension = /\.mp4$/i.test(string) ? string.slice(-4) : '';
		const basename = extension ? string.slice(0, -extension.length) : string;
		const budget = 250 - encoder.encode(extension).length;
		let prefix = '';
		let bytes = 0;
		for (const character of basename) {
			const size = encoder.encode(character).length;
			if (bytes + size > budget) break;
			prefix += character;
			bytes += size;
		}
		return `${prefix.trimEnd()}${extension}`;
	};
};
