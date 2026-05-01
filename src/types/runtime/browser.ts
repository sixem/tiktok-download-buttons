// Extension-runtime browser-family information.
//
// Content scripts ask the service worker for this because page scripts can spoof
// or shim browser-facing globals.

export type RuntimeInfo = {
	isFirefox: boolean;
	isChromium: boolean;
};
