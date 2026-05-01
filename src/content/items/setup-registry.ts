import { TTDB } from '@/content/core/state';
import type { ItemSetupData, TTDBMode } from '@/types';
import { createBrowserMode } from '@/content/modes/browser';
import { createGridMode } from '@/content/modes/grid';
import { createFeedMode } from '@/content/modes/feed';
import { createBasicPlayerMode } from '@/content/modes/basic-player';

type ItemSetupHandler = (item: Element, data: ItemSetupData) => boolean | undefined;

const setters: Partial<Record<TTDBMode, ItemSetupHandler>> = {};

export const itemSetup = {
	setters,
	set: (itemType: TTDBMode, item: Element, data: ItemSetupData) => {
		const setup = itemSetup.setters[itemType];
		return setup ? !!setup(item, data) : false;
	}
};

itemSetup.setters[TTDB.MODE.BROWSER] = createBrowserMode();
itemSetup.setters[TTDB.MODE.GRID] = createGridMode();
itemSetup.setters[TTDB.MODE.FEED] = createFeedMode();
itemSetup.setters[TTDB.MODE.BASIC_PLAYER] = createBasicPlayerMode();

