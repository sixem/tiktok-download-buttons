// Registers all content-script utilities onto the shared UTIL object.
import { UTIL } from '../state';
import { setupBrowserUtils } from './browser';
import { setupDomUtils } from './dom';
import { setupNetworkUtils } from './network';
import { setupObjectUtils } from './object';
import { setupRandomUtils } from './random';
import { setupStringUtils } from './strings';

export const setupUtils = () => {
	setupDomUtils();
	setupNetworkUtils();
	setupBrowserUtils();
	setupStringUtils();
	setupRandomUtils();
	setupObjectUtils();

	return UTIL;
};