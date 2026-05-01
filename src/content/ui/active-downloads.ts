// Lightweight UI tracker for active browser downloads.
//
// The state stays private to this module so download progress cannot be mutated
// accidentally through the broad shared TTDB state object.
import { DOM } from '@/content/core/dom';

type ActiveDownloadItem = {
	id: string;
	name: string;
	percentage: number;
};

type ActiveDownloadEntry = {
	item: ActiveDownloadItem;
	timeoutId: number;
};

const DOWNLOADS_CONTAINER_SELECTOR = 'div.ttdb_downloading-active';
const runningDownloads: Record<string, ActiveDownloadEntry> = {};

const hashActiveDownload = (input: string) => {
	return String(input.split('').reduce((hash, char) => (hash * 33) ^ char.charCodeAt(0), 5381) >>> 0);
};

const createContainer = () => {
	if (!document.body) return null;

	const container = document.createElement('div');
	container.classList.add('ttdb_downloading-active');
	container.textContent = '';
	document.body.appendChild(container);

	return container;
};

const getContainer = () => {
	if (!document.body) return null;
	return document.body.querySelector<HTMLElement>(DOWNLOADS_CONTAINER_SELECTOR) || createContainer();
};

const createActiveDownloadElement = (hash: string, item: ActiveDownloadItem) => {
	const container = getContainer();
	if (!container) return null;

	const element = document.createElement('div');
	const progress = document.createElement('div');

	element.classList.add('item');
	progress.classList.add('progress');

	element.setAttribute('id', hash);
	element.textContent = item.name;
	element.appendChild(progress);
	element.style.opacity = '1';

	container.appendChild(element);

	return element;
};

export const removeActiveDownload = (hash: string) => {
	const entry = runningDownloads[hash];
	if (entry) {
		clearTimeout(entry.timeoutId);
		delete runningDownloads[hash];
	}

	refreshActiveDownloads();
};

export const refreshActiveDownloads = () => {
	const activeHashes = Object.keys(runningDownloads);
	const container = getContainer();
	if (!container) return;

	if (!activeHashes.length) {
		container.textContent = '';
		return DOM.setStyle(container, { opacity: '0' });
	}

	DOM.setStyle(container, { opacity: '1' });

	for (const hash of activeHashes) {
		const entry = runningDownloads[hash];
		if (!entry) continue;

		const { item } = entry;
		const element = container.querySelector<HTMLElement>(`:scope > div[id="${hash}"]`)
			|| createActiveDownloadElement(hash, item);
		if (!element) continue;

		const progress = element.querySelector<HTMLElement>(':scope > div.progress');
		const percentage = Math.ceil(item.percentage);

		if (progress) {
			progress.style.minWidth = `${percentage}%`;
		}

		if (percentage >= 100 && !element.dataset.completing) {
			element.dataset.completing = 'true';
			window.setTimeout(() => {
				element.style.opacity = '0';
				window.setTimeout(() => {
					removeActiveDownload(hash);
				}, 1250);
			}, 1000);
		}
	}
};

export const pingActiveDownload = (item: ActiveDownloadItem) => {
	const hash = hashActiveDownload(item.id);
	const existing = runningDownloads[hash];

	if (!existing) {
		runningDownloads[hash] = {
			item: { ...item },
			timeoutId: window.setTimeout(() => removeActiveDownload(hash), 10_000)
		};

		refreshActiveDownloads();
		return;
	}

	clearTimeout(existing.timeoutId);
	existing.timeoutId = window.setTimeout(() => removeActiveDownload(hash), 10_000);
	existing.item = { ...existing.item, ...item };

	refreshActiveDownloads();
};

export const setupActiveDownloads = () => {
	return {
		ping: pingActiveDownload,
		remove: removeActiveDownload,
		refresh: refreshActiveDownloads
	};
};

