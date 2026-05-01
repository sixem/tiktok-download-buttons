// Entry point for item metadata extraction by mode.
import { TTDB } from '@/content/core/state';
import { extractFeedData } from '@/content/item-data/feed';
import { extractGridData } from '@/content/item-data/grid';
import { extractBrowserData } from '@/content/item-data/browser';
import { extractBasicPlayerData } from '@/content/item-data/basic-player';
import { getVideoElementUrl } from '@/content/item-data/extraction-helpers';
import type { ItemSetupData, ItemVideoData, TTDBMode } from '@/types';

export type { ItemSetupData, ItemVideoData } from '@/types';

type ItemDataExtractor = (data: ItemSetupData) => Partial<ItemVideoData>;

const extractors: Partial<Record<TTDBMode, ItemDataExtractor>> = {};

export const itemData = {
	extract: extractors,
	get: (container: ParentNode, data: ItemSetupData): ItemVideoData => {
		let videoData: ItemVideoData = { id: null, user: null, url: null };

		videoData.url = getVideoElementUrl(container);

		const extractor = itemData.extract[data.mode];
		if (extractor) {
			videoData = {
				...videoData,
				...extractor(data)
			};

			if (!videoData.id) {
				videoData.id = Date.now();
			}
		}

		return videoData;
	}
};

itemData.extract[TTDB.MODE.FEED] = extractFeedData;
itemData.extract[TTDB.MODE.GRID] = extractGridData;
itemData.extract[TTDB.MODE.BROWSER] = extractBrowserData;
itemData.extract[TTDB.MODE.BASIC_PLAYER] = extractBasicPlayerData;
