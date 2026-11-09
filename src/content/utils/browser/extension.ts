// Content-script helpers for extension APIs.
// Keeps callback-based chrome APIs usable with async/await in Firefox MV3.

import type { RuntimeInfo } from '@/types';

export type { RuntimeInfo } from '@/types';

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

const normalizeRuntimeInfo = (value): RuntimeInfo => {
	if (!value || typeof value !== 'object' || (value as any).success === false) {
		throw new Error('Runtime info is unavailable');
	}

	const isFirefox = !!(value as any).isFirefox;
	const isChromium = typeof (value as any).isChromium === 'boolean'
		? !!(value as any).isChromium
		: !isFirefox;

	return {
		isFirefox,
		isChromium: !isFirefox && isChromium
	};
};

// Cached extension-context runtime info.
// Content scripts can be affected by site shims (UA spoofing, etc), so we prefer asking
// the service worker for stable browser-family booleans once per page load.
let runtimeInfoCache: RuntimeInfo | null = null;
let runtimeInfoPromise: Promise<RuntimeInfo> | null = null;

export const getRuntimeInfo = async (): Promise<RuntimeInfo> => {
	if (runtimeInfoCache) {
		return runtimeInfoCache;
	}

	if (!runtimeInfoPromise) {
		runtimeInfoPromise = sendRuntimeMessage({ task: 'runtimeInfo' })
			.then((info) => normalizeRuntimeInfo(info));
	}

	runtimeInfoCache = await runtimeInfoPromise;
	return runtimeInfoCache;
};

export const storageGet = (key) => new Promise((resolve, reject) => {
	try {
		chrome.storage.local.get(key, wrapCallback(resolve, reject));
	} catch (error) {
		reject(error);
	}
});
