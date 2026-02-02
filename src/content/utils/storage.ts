export const getStoredSetting = async (key) => {
	const stored = await chrome.storage.local.get(key);

	if (stored && Object.prototype.hasOwnProperty.call(stored, key)) {
		return stored[key];
	}

	return null;
};
