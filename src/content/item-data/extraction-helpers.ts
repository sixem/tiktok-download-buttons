// Shared helpers for extracting item metadata across modes.
import { TTDB } from '../state';
import { DOM } from '../dom';

const DESCRIPTION_SELECTORS = {
	app: 'span[class*="-SpanText "]',
	__next: 'div[class*="video-meta-caption"]'
};

const isQueryable = (root) => {
	return !!root && typeof root.querySelector === 'function';
};

export const getTextContent = (element, { trim = true } = {}) => {
	if (!element || element.textContent === null) return null;
	return trim ? element.textContent.trim() : element.textContent;
};

export const getUserFromHref = (href) => {
	if (!href) return null;
	const parts = href.split('/@');
	if (parts.length < 2) return null;

	let user = parts[1];
	if (user.includes('?')) {
		user = user.split('?')[0];
	}

	return user || null;
};

export const getUserFromProfileLink = (element) => {
	if (!element) return null;
	return getUserFromHref(element.getAttribute('href'));
};

export const selectFirst = (container, selectors) => {
	if (!isQueryable(container)) return null;
	return container.querySelector(DOM.multiSelector(selectors));
};

export const selectNamed = (container, selectors, fallback): Record<string, Element | null> => {
	const resolved: Record<string, Element | null> = {};
	const fallbackRoot = isQueryable(fallback) ? fallback : null;

	Object.entries(selectors).forEach(([key, selector]) => {
		let found = null;

		if (isQueryable(container)) {
			found = container.querySelector(selector);
		}

		if (!found && fallbackRoot) {
			found = fallbackRoot.querySelector(selector);
		}

		resolved[key] = found || null;
	});

	return resolved;
};

export const extractDescriptionId = (container, env = TTDB.ENV.APP) => {
	let identifier = null;
	let extracted = null;

	if (env === TTDB.ENV.APP) {
		const description = isQueryable(container)
			? container.querySelector(DESCRIPTION_SELECTORS.app)
			: null;

		if (description && description.parentElement) {
			extracted = description.parentElement.textContent;
		}
	} else if (env === TTDB.ENV.__NEXT) {
		const metaTitle = isQueryable(container)
			? container.querySelector(DESCRIPTION_SELECTORS.__next)
			: null;

		if (metaTitle) {
			extracted = metaTitle.textContent;
		}
	}

	if (extracted) {
		extracted = extracted.replace(/[/\\?%*:|"<>]/g, '-').toLowerCase().trim();

		if (extracted && extracted.length > 0) {
			identifier = extracted;
		}
	}

	return identifier;
};

export const getVideoElementUrl = (container) => {
	if (!isQueryable(container)) return null;

	const videoElement = container.querySelector('video');
	if (!videoElement) return null;

	let url = videoElement.currentSrc
		|| videoElement.src
		|| videoElement.getAttribute('src');

	if (!url) {
		const sourceElement = videoElement.querySelector('source');
		if (sourceElement) {
			url = sourceElement.src || sourceElement.getAttribute('src');
		}
	}

	return url || null;
};
