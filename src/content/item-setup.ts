import { TTDB } from './state';
import { createBrowserMode } from './modes/browser';
import { createGridMode } from './modes/grid';
import { createFeedMode } from './modes/feed';
import { createBasicPlayerMode } from './modes/basic-player';

export const itemSetup: any = { setters: {} };

itemSetup.setters[TTDB.MODE.BROWSER] = createBrowserMode();
itemSetup.setters[TTDB.MODE.GRID] = createGridMode();
itemSetup.setters[TTDB.MODE.FEED] = createFeedMode();
itemSetup.setters[TTDB.MODE.BASIC_PLAYER] = createBasicPlayerMode();

itemSetup.set = (itemType, item, data) => {
	return itemSetup.setters[itemType](item, data);
};

