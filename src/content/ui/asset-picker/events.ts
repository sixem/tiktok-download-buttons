// Asset-picker event wiring and lifecycle handlers.
//
// This module owns click/keyboard bindings and keeps behavior centralized.

import { SPLASH } from '@/content/core/state';
import { setButtonContent } from '@/content/ui/asset-picker/dom';
import {
	assetPickerState,
	BODY_OPEN_CLASS,
	DEFAULT_HINT,
	THUMB_SELECTOR,
	VISIBLE_CLASS
} from './state';
import { getSelectedEntries } from '@/content/ui/asset-picker/state';
import {
	setAllThumbsSelectedState,
	toggleThumbSelection,
	updateStatus,
	updateThumbLoadStateFromImageEvent
} from './render';

const showPrimaryActionError = (error: unknown) => {
	if (!SPLASH || typeof SPLASH.message !== 'function') return;

	SPLASH.message({
		title: 'Action failed',
		detail: error instanceof Error ? error.message : 'Primary action failed.'
	}, {
		duration: 4200,
		state: 3,
		hideMeta: true
	});
};

export const closeAssetPickerModal = () => {
	const dom = assetPickerState.dom;
	if (!dom) return;

	assetPickerState.isOpen = false;
	dom.wrapper.classList.remove(VISIBLE_CLASS);
	dom.wrapper.setAttribute('aria-hidden', 'true');
	document.body.classList.remove(BODY_OPEN_CLASS);
};

const handlePrimaryAction = () => {
	const dom = assetPickerState.dom;
	if (!dom) return;

	const selectedAssets = getSelectedEntries().map((entry) => entry.asset);
	if (!selectedAssets.length) return;

	if (typeof assetPickerState.onPrimary === 'function') {
		const onPrimary = assetPickerState.onPrimary;
		if (assetPickerState.closeOnPrimary) {
			closeAssetPickerModal();
		}

		try {
			Promise.resolve(onPrimary(selectedAssets)).catch((error) => {
				showPrimaryActionError(error);
			});
		} catch (error) {
			showPrimaryActionError(error);
		}
		return;
	}

	dom.hint.textContent = DEFAULT_HINT;
	if (SPLASH && typeof SPLASH.message === 'function') {
		SPLASH.message({
			title: 'Action unavailable',
			detail: 'Primary action is not wired for this picker yet.'
		}, {
			duration: 2800,
			state: 2,
			hideMeta: true
		});
	}
};

const attachGridDelegatedListeners = () => {
	const dom = assetPickerState.dom;
	if (!dom) return;

	dom.grid.addEventListener('click', (event) => {
		const target = event.target as HTMLElement | null;
		if (!target) return;

		const thumb = target.closest<HTMLElement>(THUMB_SELECTOR);
		if (!thumb || !dom.grid.contains(thumb)) return;

		const entryId = thumb.dataset.entryId || '';
		toggleThumbSelection(entryId, thumb);
	});

	// `load`/`error` do not bubble, so capture on the grid container.
	dom.grid.addEventListener('load', (event) => {
		const target = event.target;
		if (!(target instanceof HTMLImageElement)) return;
		if (!target.classList.contains('ttdb_asset-picker__image')) return;
		updateThumbLoadStateFromImageEvent('load', target);
	}, true);

	dom.grid.addEventListener('error', (event) => {
		const target = event.target;
		if (!(target instanceof HTMLImageElement)) return;
		if (!target.classList.contains('ttdb_asset-picker__image')) return;
		updateThumbLoadStateFromImageEvent('error', target);
	}, true);
};

const attachGlobalEscapeListener = () => {
	if (assetPickerState.keydownBound) return;

	window.addEventListener('keydown', (e) => {
		if (!assetPickerState.isOpen) return;
		if (e.key !== 'Escape') return;

		e.preventDefault();
		closeAssetPickerModal();
	});

	assetPickerState.keydownBound = true;
};

export const attachAssetPickerDomListeners = () => {
	const dom = assetPickerState.dom;
	if (!dom || assetPickerState.domListenersBound) return;

	dom.closeButton.addEventListener('click', () => closeAssetPickerModal());
	dom.cancelButton.addEventListener('click', () => closeAssetPickerModal());
	dom.backdrop.addEventListener('click', () => closeAssetPickerModal());

	dom.selectAllButton.addEventListener('click', () => {
		assetPickerState.selected = new Set(assetPickerState.entries.map((entry) => entry.id));
		setAllThumbsSelectedState(true);
		updateStatus();
	});

	dom.clearAllButton.addEventListener('click', () => {
		assetPickerState.selected.clear();
		setAllThumbsSelectedState(false);
		updateStatus();
	});

	dom.primaryButton.addEventListener('click', () => {
		handlePrimaryAction();
	});

	attachGridDelegatedListeners();
	attachGlobalEscapeListener();

	// Ensure button icon/text shape is consistent after listener wiring.
	setButtonContent(dom.primaryButton, assetPickerState.primaryLabel, 'download');
	assetPickerState.domListenersBound = true;
};
