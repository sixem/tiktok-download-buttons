// Asset-picker rendering helpers.
//
// Rendering is pure relative to current state: it only reads state and updates DOM.

import { createIconCheck } from '../icons';
import { setButtonContent } from './dom';
import {
	assetPickerState,
	DEFAULT_PRIMARY_LABEL,
	THUMB_SELECTOR
} from './state';

const createNode = <T extends HTMLElement>(tag: string, className: string, text = '') => {
	const node = document.createElement(tag) as T;
	node.className = className;
	if (text) {
		node.textContent = text;
	}
	return node;
};

const setThumbSelectedState = (thumb: HTMLElement, selected: boolean) => {
	thumb.classList.toggle('is-selected', selected);
	thumb.setAttribute('aria-pressed', selected ? 'true' : 'false');
};

export const setAllThumbsSelectedState = (selected: boolean) => {
	const dom = assetPickerState.dom;
	if (!dom) return;

	dom.grid.querySelectorAll<HTMLElement>(THUMB_SELECTOR).forEach((thumb) => {
		setThumbSelectedState(thumb, selected);
	});
};

export const updateStatus = () => {
	const dom = assetPickerState.dom;
	if (!dom) return;

	const total = assetPickerState.entries.length;
	const selectedCount = assetPickerState.selected.size;
	const allSelected = total > 0 && selectedCount === total;
	const noneSelected = selectedCount === 0;

	dom.status.textContent = `${selectedCount}/${total} selected`;
	dom.selectAllButton.disabled = total === 0 || allSelected;
	dom.clearAllButton.disabled = total === 0 || noneSelected;
	dom.primaryButton.disabled = total === 0 || noneSelected;

	const primaryLabelBase = assetPickerState.primaryLabel || DEFAULT_PRIMARY_LABEL;
	const primaryLabel = total > 0 ? `${primaryLabelBase} (${selectedCount})` : primaryLabelBase;
	setButtonContent(dom.primaryButton, primaryLabel, 'download');
};

export const toggleThumbSelection = (entryId: string, thumb: HTMLElement) => {
	if (!entryId) return;

	if (assetPickerState.selected.has(entryId)) {
		assetPickerState.selected.delete(entryId);
		setThumbSelectedState(thumb, false);
	} else {
		assetPickerState.selected.add(entryId);
		setThumbSelectedState(thumb, true);
	}

	updateStatus();
};

export const updateThumbLoadStateFromImageEvent = (eventType: 'load' | 'error', image: HTMLImageElement) => {
	const thumb = image.closest<HTMLElement>(THUMB_SELECTOR);
	if (!thumb) return;

	thumb.classList.remove('is-loading');
	if (eventType === 'load') {
		thumb.classList.remove('is-error');
		thumb.classList.add('is-loaded');
		return;
	}

	thumb.classList.remove('is-loaded');
	thumb.classList.add('is-error');
};

export const renderEntries = () => {
	const dom = assetPickerState.dom;
	if (!dom) return;

	dom.grid.textContent = '';

	const fragment = document.createDocumentFragment();

	assetPickerState.entries.forEach((entry, idx) => {
		const label = entry.asset.label || `Item ${entry.index}`;
		const selected = assetPickerState.selected.has(entry.id);

		const thumbClassName = selected
			? 'ttdb_asset-picker__thumb is-selected is-loading'
			: 'ttdb_asset-picker__thumb is-loading';
		const thumb = createNode<HTMLButtonElement>('button', thumbClassName);
		thumb.type = 'button';
		thumb.draggable = false;
		thumb.dataset.entryId = entry.id;
		thumb.setAttribute('aria-pressed', selected ? 'true' : 'false');
		thumb.setAttribute('aria-label', `Toggle ${label}`);
		thumb.style.setProperty('--ttdb-thumb-delay', `${Math.min(idx * 28, 280)}ms`);

		const check = createNode<HTMLSpanElement>('span', 'ttdb_asset-picker__check');
		check.appendChild(createIconCheck('ttdb_asset-picker__checkIcon'));

		const indexTag = createNode<HTMLSpanElement>('span', 'ttdb_asset-picker__index', String(entry.index));

		const img = document.createElement('img');
		img.className = 'ttdb_asset-picker__image';
		img.loading = 'lazy';
		img.decoding = 'async';
		img.draggable = false;
		img.alt = label;
		img.src = entry.asset.thumbnailUrl || entry.asset.url;

		const meta = createNode<HTMLSpanElement>('span', 'ttdb_asset-picker__meta', entry.asset.meta || label);

		thumb.appendChild(check);
		thumb.appendChild(indexTag);
		thumb.appendChild(img);
		thumb.appendChild(meta);
		fragment.appendChild(thumb);
	});

	dom.grid.appendChild(fragment);
};
