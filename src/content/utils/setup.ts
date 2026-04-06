// Registers the shared UTIL helpers used across the content script.

import { UTIL } from '@/content/core/state';
import { setupDomUtils } from '@/content/utils/dom';
import { setupNetworkUtils } from '@/content/utils/network';
import { setupObjectUtils, setupRandomUtils, setupStringUtils } from '@/content/utils/data';

export const setupUtils = () => {
	setupDomUtils();
	setupNetworkUtils();
	setupStringUtils();
	setupRandomUtils();
	setupObjectUtils();

	return UTIL;
};
