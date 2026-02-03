// Reads a single stored value using a promise wrapper for callback APIs.
import { storageGet } from './extension';

export const getStoredSetting = async (key) => {
	const stored = await storageGet(key);

	if (stored && Object.prototype.hasOwnProperty.call(stored, key)) {
		return stored[key];
	}

	return null;
};
