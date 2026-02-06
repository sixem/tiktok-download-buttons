// Popup helpers for callback-based extension APIs.
// Localized here to avoid shared build chunks across entrypoints.

const wrapCallback = (resolve, reject) => (result) => {
	const error = chrome.runtime?.lastError;
	if (error) {
		reject(new Error(error.message || String(error)));
		return;
	}
	resolve(result);
};

export const storageSet = (value) => new Promise((resolve, reject) => {
	try {
		chrome.storage.local.set(value, wrapCallback(resolve, reject));
	} catch (error) {
		reject(error);
	}
});

export const storageGet = (keys) => new Promise((resolve, reject) => {
	try {
		chrome.storage.local.get(keys, wrapCallback(resolve, reject));
	} catch (error) {
		reject(error);
	}
});
