// Browser detection helpers for runtime behavior differences.
import { UTIL } from '../state';

export const setupBrowserUtils = () => {
	// Detect Firefox/Gecko (MV3 differs in a few important extension behaviors).
	UTIL.isFirefox = () => {
		// Firefox-only: content scripts expose `wrappedJSObject` on `window`.
		// TikTok can spoof UA / some globals, but this tends to be a stable Gecko signal.
		if (typeof (globalThis as any).wrappedJSObject !== 'undefined') return true;

		const rt = ((globalThis as any).browser ?? (globalThis as any).chrome)?.runtime as any;
		if (typeof rt?.getBrowserInfo === 'function') return true;

		// Firefox exposes `InstallTrigger` on window/globalThis.
		// This is a common lightweight fingerprint that survives UA spoofing.
		if (typeof (globalThis as any).InstallTrigger !== 'undefined') return true;

		// Fallback: UA sniffing (less reliable if the user spoofs UA).
		return /Firefox/i.test(navigator.userAgent);
	};

	// Detect Chromium-based engines for API and event handling.
	UTIL.isChromium = () => {
		// If we're in Firefox, bail out early.
		if (typeof (globalThis as any).wrappedJSObject !== 'undefined') return false;

		const rt = ((globalThis as any).browser ?? (globalThis as any).chrome)?.runtime as any;

		if (typeof rt?.getBrowserInfo === 'function') return false;
		if (typeof (globalThis as any).InstallTrigger !== 'undefined') return false;
		if (/Firefox/i.test(navigator.userAgent)) return false;
		if (navigator.userAgentData?.brands) {
			return navigator.userAgentData.brands
				.some((b) => /Chrom(e|ium)|Edge|Opera/i.test(b.brand));
		}

		return /Chrome|Chromium|Edg|OPR|Brave|Vivaldi/i.test(navigator.userAgent);
	};
};
