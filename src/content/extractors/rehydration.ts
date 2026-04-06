import { UTIL } from '@/content/core/state';
import { pipe } from '@/content/core/logging';

export const parseRehydrationData = (rootDocument = document) => {
	const script = rootDocument.querySelector('script#__UNIVERSAL_DATA_FOR_REHYDRATION__')
		|| rootDocument.querySelector('script#SIGI_STATE')
		|| rootDocument.querySelector('script#__NEXT_DATA__');
	if (!script) return null;

	const raw = (script.textContent || script.innerText || '').trim();
	if (!raw) return null;

	let jsonText = raw;
	const start = raw.indexOf('{');
	const end = raw.lastIndexOf('}');
	if (start > 0 && end > start) {
		jsonText = raw.slice(start, end + 1);
	}

	try {
		return JSON.parse(jsonText);
	} catch (error) {
		pipe('Error parsing rehydration data', error);
		return null;
	}
};

export const extractMetaVideoInfo = (rootDocument = document) => {
	if (!rootDocument) return null;

	const readMeta = (selector) => {
		const el = rootDocument.querySelector(selector);
		if (!el) return null;
		const value = (el.getAttribute('content') || '').trim();
		return value.length > 0 ? value : null;
	};

	const url = readMeta('meta[property="og:video"]')
		|| readMeta('meta[property="og:video:secure_url"]')
		|| readMeta('meta[property="og:video:url"]')
		|| readMeta('meta[name="twitter:player:stream"]');

	if (!url || !/^https?:/i.test(url)) return null;

	return {
		url,
		title: readMeta('meta[property="og:title"]'),
		description: readMeta('meta[property="og:description"]') || readMeta('meta[name="description"]')
	};
};

const matchesVideoId = (item, videoId) => {
	if (!item || !videoId) return false;
	const itemId = item.id || item.aweme_id || (item.video && item.video.id) || (item.itemStruct && item.itemStruct.id);
	return itemId && String(itemId) === String(videoId);
};

const findVideoStructById = (root, videoId, seen = new Set()) => {
	if (!root || typeof root !== 'object') return null;
	if (seen.has(root)) return null;
	seen.add(root);

	if (matchesVideoId(root, videoId)) {
		if (root.video) return root;
		if (root.itemStruct && root.itemStruct.video) return root.itemStruct;
	}

	if (root.itemStruct && matchesVideoId(root.itemStruct, videoId)) {
		return root.itemStruct;
	}

	const values = Array.isArray(root) ? root : Object.values(root);
	for (const value of values) {
		const found = findVideoStructById(value, videoId, seen);
		if (found) return found;
	}

	return null;
};

export const extractWebappDetail = (UD, videoId = null) => {
	if (!UD) return { status: null, webappDetail: null };

	const scope = UD.__DEFAULT_SCOPE__ || UD;
	let status = UTIL.traverseObj(scope, ['webapp.video-detail', 'statusCode']);
	if (status === undefined || status === null) {
		status = UTIL.traverseObj(UD, ['webapp.video-detail', 'statusCode']);
	}

	let webappDetail = UTIL.traverseObj(scope, ['webapp.video-detail', 'itemInfo', 'itemStruct'])
		|| UTIL.traverseObj(UD, ['webapp.video-detail', 'itemInfo', 'itemStruct']);

	if (videoId && webappDetail && !matchesVideoId(webappDetail, videoId)) {
		webappDetail = null;
		status = null;
	}

	if (!webappDetail) {
		const itemModule = UTIL.traverseObj(scope, ['webapp.video-detail', 'itemModule'])
			|| UTIL.traverseObj(scope, ['itemModule'])
			|| UTIL.traverseObj(scope, ['ItemModule'])
			|| UTIL.traverseObj(UD, ['webapp.video-detail', 'itemModule'])
			|| UTIL.traverseObj(UD, ['itemModule'])
			|| UTIL.traverseObj(UD, ['ItemModule']);

		if (itemModule && typeof itemModule === 'object') {
			if (videoId && itemModule[videoId]) {
				webappDetail = itemModule[videoId];
			} else {
				const moduleValues = Object.values(itemModule);
				if (videoId) {
					webappDetail = moduleValues.find((item) => {
						if (!item) return false;
						const itemId = item.id || item.aweme_id || item?.video?.id;
						return itemId && String(itemId) === String(videoId);
					});
				}
				if (!webappDetail && !videoId && moduleValues.length > 0) {
					webappDetail = moduleValues[0];
				}
			}
		}
	}

	if (videoId && webappDetail && !matchesVideoId(webappDetail, videoId)) {
		webappDetail = null;
		status = null;
	}

	if (!webappDetail && videoId) {
		webappDetail = findVideoStructById(UD, videoId);
	}

	return { status: status || 0, webappDetail };
};

