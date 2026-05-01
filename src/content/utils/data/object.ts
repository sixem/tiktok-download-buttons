// Object traversal helper for nested data extraction.
import { UTIL } from '@/content/core/state';

export const setupObjectUtils = () => {
	// Walk nested objects to locate a key path anywhere in the tree.
	UTIL.traverseObj = (obj, needles, index = 0) => {
		if (obj !== null && typeof obj === 'object' && index < needles.length) {
			const needle = needles[index];

			for (const key of Object.keys(obj)) {
				if (key === needle) {
					if (index === needles.length - 1) {
						return obj[key];
					}
					return UTIL.traverseObj(obj[key], needles, index + 1);
				}
			}

			for (const key of Object.keys(obj)) {
				const result = UTIL.traverseObj(obj[key], needles, index);
				if (result !== undefined) {
					return result;
				}
			}
		}

		return undefined;
	};
};
