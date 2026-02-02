import { UTIL } from '../state';

export const setupUtils = () => {
	UTIL.dispatchEvent = (element, eventType, event) => {
		element.dispatchEvent(new eventType(event, {
			bubbles: true,
			cancelable: true,
			view: window
		}));
	};

	UTIL.validateVideoRequest = (t) => {
		const contentType = t.headers.get('Content-Type') || '';

		return t.ok && (contentType.includes('video/')
				|| contentType.includes('application/octet-stream'))
				&& +t.headers.get('Content-Length') > 1000;
	};

	UTIL.isChromium = () => {
		const rt = (globalThis.browser ?? globalThis.chrome)?.runtime;

		if (rt?.getBrowserInfo) return false;
		if (navigator.userAgentData?.brands) {
			return navigator.userAgentData.brands
				.some((b) => /Chrom(e|ium)|Edge|Opera/i.test(b.brand));
		}

		return /Chrome|Chromium|Edg|OPR|Brave|Vivaldi/i.test(navigator.userAgent);
	};

	UTIL.truncateString = (string, n) => {
		return (string.length > n) ? string.substr(0, n - 1) : string;
	};

	UTIL.ranGen = (charSet, length = 16) => {
		let result = '';
		const setLength = charSet.length;

		for (let i = 0; i < length; i++) {
			result += charSet.charAt(Math.floor(Math.random() * setLength));
		}

		return result;
	};

	UTIL.ranInt = (min, max) => {
		return Math.floor(Math.random() * (max - min + 1) + min);
	};

	UTIL.sanitizeFilename = (string) => {
		string = string.replace(
			/[^\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\wÐ°-Ñ0-9a-zA-Z-._ #()\[\]]/g, ''
		).replace(/\s\s+/g, ' ').trim();

		while (string[0] === '.') {
			string = string.substring(1);
		}

		return (string.length - 4) >= 246 ? `${string.replace('.mp4', '').substring(0, 246).trim()}.mp4` : string;
	};

	UTIL.checkNested = (obj, level, ...rest) => {
		if (obj === undefined) return false;
		if (rest.length == 0 && obj.hasOwnProperty(level)) return true;

		return UTIL.checkNested(obj[level], ...rest);
	};

	UTIL.traverseObj = (obj, needles, index = 0) => {
		if (obj !== null && typeof obj === 'object' && index < needles.length) {
			const needle = needles[index];

			for (const key of Object.keys(obj)) {
				if (key === needle) {
					if (index === needles.length - 1) {
						return obj[key];
					}
					return UTIL.traverseObj(obj[key], needles, index + 1);
				}
			}

			for (const key of Object.keys(obj)) {
				const result = UTIL.traverseObj(obj[key], needles, index);
				if (result !== undefined) {
					return result;
				}
			}
		}

		return undefined;
	};

	return UTIL;
};

