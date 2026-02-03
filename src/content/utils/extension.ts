// Content-script helpers for extension APIs.
// Keeps callback-based chrome APIs usable with async/await in Firefox MV3.

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

export const storageGet = (key) => new Promise((resolve, reject) => {
	try {
		chrome.storage.local.get(key, wrapCallback(resolve, reject));
	} catch (error) {
		reject(error);
	}
});
