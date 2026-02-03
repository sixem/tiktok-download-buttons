// Entry point for item metadata extraction by mode.
import { TTDB } from './state';
import { extractFeedData } from './item-data/feed';
import { extractGridData } from './item-data/grid';
import { extractBrowserData } from './item-data/browser';
import { extractBasicPlayerData } from './item-data/basic-player';
import { getVideoElementUrl } from './item-data/extraction-helpers';

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