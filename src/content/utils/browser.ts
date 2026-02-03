// Browser detection helpers for runtime behavior differences.
import { UTIL } from '../state';

export const setupBrowserUtils = () => {
	// Detect Chromium-based engines for API and event handling.
	UTIL.isChromium = () => {
		const rt = (globalThis.browser ?? globalThis.chrome)?.runtime;

		if (rt?.getBrowserInfo) return false;
		if (navigator.userAgentData?.brands) {
			return navigator.userAgentData.brands
				.some((b) => /Chrom(e|ium)|Edge|Opera/i.test(b.brand));
		}

		return /Chrome|Chromium|Edg|OPR|Brave|Vivaldi/i.test(navigator.userAgent);
	};
};
