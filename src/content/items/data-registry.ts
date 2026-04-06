// Entry point for item metadata extraction by mode.
import { TTDB } from '@/content/core/state';
import { extractFeedData } from '@/content/item-data/feed';
import { extractGridData } from '@/content/item-data/grid';
import { extractBrowserData } from '@/content/item-data/browser';
import { extractBasicPlayerData } from '@/content/item-data/basic-player';
import { getVideoElementUrl } from '@/content/item-data/extraction-helpers';

export const itemData: any = { extract: {} };

itemData.extract[TTDB.MODE.FEED] = extractFeedData;
itemData.extract[TTDB.MODE.GRID] = extractGridData;
itemData.extract[TTDB.MODE.BROWSER] = extractBrowserData;
itemData.extract[TTDB.MODE.BASIC_PLAYER] = extractBasicPlayerData;

itemData.get = (container, data) => {
	let videoData = { id: null, user: null, url: null };

	videoData.url = getVideoElementUrl(container);

	if (itemData.extract[data.mode]) {
		videoData = {
			...videoData,
			...itemData.extract[data.mode](data)
		};

		if (!videoData.id) {
			videoData.id = Date.now();
		}
	}

	return videoData;
};
