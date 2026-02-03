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

export const sendRuntimeMessage = (message, extensionId = null) => new Promise((resolve, reject) => {
	try {
		const callback = wrapCallback(resolve, reject);
		if (typeof extensionId === 'string' && extensionId.length > 0) {
			chrome.runtime.sendMessage(extensionId, message, callback);
		} else {
			chrome.runtime.sendMessage(message, callback);
		}
	} catch (error) {
		reject(error);
	}
});

export const storageSet = (value) => new Promise((resolve, reject) => {
	try {
		chrome.storage.local.set(value, wrapCallback(resolve, reject));
	} catch (error) {
		reject(error);
	}
});
