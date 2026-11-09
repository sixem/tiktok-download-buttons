// Shared asset-list normalization helpers.
//
// Multiple download/picker flows accept "asset-like" objects that only really
// require a usable URL. Centralizing the cleanup avoids subtle drift.

import { isDataUrl } from '@/content/utils/data/url';

type AssetWithUrl = {
	url?: string | null;
};

export const normalizeAssetList = <T extends AssetWithUrl>(
	assets: T[],
	{
		allowDataUrls = true
	}: {
		allowDataUrls?: boolean;
	} = {}
) => {
	const seen = new Set<string>();
	const normalized: Array<T & { url: string }> = [];

	(assets || []).forEach((asset) => {
		if (!asset?.url) return;

		const url = String(asset.url).trim();
		if (!url) return;
		if (!allowDataUrls && isDataUrl(url)) return;
		if (seen.has(url)) return;

		seen.add(url);
		normalized.push({
			...asset,
			url
		});
	});

	return normalized;
};
