// Registers legacy content-script utilities onto the shared UTIL object.
//
// This stays separate from `index.ts` so the main utils entry can act as a
// normal barrel-export module.

import { UTIL } from '@/content/state';
import { setupDomUtils } from '@/content/utils/dom';
import { setupNetworkUtils } from '@/content/utils/network';
import { setupObjectUtils } from '@/content/utils/object';
import { setupRandomUtils } from '@/content/utils/random';
import { setupStringUtils } from '@/content/utils/strings';

export const setupUtils = () => {
	setupDomUtils();
	setupNetworkUtils();
	setupStringUtils();
	setupRandomUtils();
	setupObjectUtils();

	return UTIL;
};
