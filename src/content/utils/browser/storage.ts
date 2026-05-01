// Reads a single stored value using a promise wrapper for callback APIs.
import { storageGet } from '@/content/utils/browser/extension';

export const getStoredSetting = async (key) => {
	const stored = await storageGet(key);

	if (stored && typeof stored === 'object' && Object.hasOwn(stored, key)) {
		return stored[key];
	}

	return null;
};
