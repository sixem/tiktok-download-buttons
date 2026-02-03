// Random generation helpers for IDs and ranges.
import { UTIL } from '../state';

export const setupRandomUtils = () => {
	// Generate a random string from a character set.
	UTIL.ranGen = (charSet, length = 16) => {
		let result = '';
		const setLength = charSet.length;

		for (let i = 0; i < length; i++) {
			result += charSet.charAt(Math.floor(Math.random() * setLength));
		}

		return result;
	};

	// Generate a random integer within a range.
	UTIL.ranInt = (min, max) => {
		return Math.floor(Math.random() * (max - min + 1) + min);
	};
};
