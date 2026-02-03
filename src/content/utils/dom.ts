// DOM-focused helpers registered on UTIL for the content script.
import { UTIL } from '../state';

export const setupDomUtils = () => {
	// Dispatch an event with consistent bubbling and cancelability.
	UTIL.dispatchEvent = (element, eventType, event) => {
		element.dispatchEvent(new eventType(event, {
			bubbles: true,
			cancelable: true,
			view: window
		}));
	};
};
