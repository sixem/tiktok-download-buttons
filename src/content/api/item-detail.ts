import { TTDB } from '@/content/state';

export const getItemDetailApiData = async (videoId) => {
	if (!videoId) throw new Error('No video ID provided');
	const url = `https://www.tiktok.com/api/item/detail/?aid=1988&itemId=${videoId}`;
	const response = await fetch(url, TTDB.headers);
	const contentType = response.headers.get('content-type') || '';
	if (!response.ok) {
		throw new Error(`Item detail API HTTP ${response.status}`);
	}

	let data = null;
	try {
		const raw = await response.text();
		const cleaned = raw
			.trim()
			.replace(/^for\s*\(;;\);\s*/i, '')
			.replace(/^\)\]\}',?\s*/, '');

		data = JSON.parse(cleaned);
	} catch (error) {
		throw new Error(`Item detail API JSON parse failed (${contentType})`);
	}

	const itemStruct = data && data.itemInfo ? data.itemInfo.itemStruct : null;
	if (!itemStruct) {
		throw new Error('Item detail API returned no itemStruct');
	}

	return itemStruct;
};

