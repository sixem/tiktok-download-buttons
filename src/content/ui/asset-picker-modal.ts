// Reusable asset-picker modal facade.
//
// Internal responsibilities are split under `ui/asset-picker/*`:
// - state.ts  : runtime state + model helpers
// - dom.ts    : static DOM scaffold creation
// - render.ts : list/status rendering
// - events.ts : listeners and open/close lifecycle

import { TTDB } from '@/content/state';
import { attachAssetPickerDomListeners } from '@/content/ui/asset-picker/events';
import { ensureAssetPickerDom, setButtonContent } from '@/content/ui/asset-picker/dom';
import { renderEntries, updateStatus } from '@/content/ui/asset-picker/render';
import {
	assetPickerState,
	BODY_OPEN_CLASS,
	DEFAULT_HINT,
	DEFAULT_PRIMARY_LABEL,
	DEFAULT_SUBTITLE,
	DEFAULT_TITLE,
	normalizeAssets,
	setEntriesFromAssets,
	VISIBLE_CLASS,
	type OpenAssetPickerOptions,
	type PickerAsset
} from './asset-picker/state';

export type {
	OpenAssetPickerOptions,
	PickerAsset
};

export const openAssetPickerModal = (options: OpenAssetPickerOptions) => {
	const dom = ensureAssetPickerDom();
	attachAssetPickerDomListeners();

	const normalizedAssets = normalizeAssets(options?.assets || []);
	if (!normalizedAssets.length) {
		// Keep this intentionally light: callers may decide whether "no assets" is expected.
		dom.hint.textContent = 'No assets were found for this picker.';
		return;
	}

	setEntriesFromAssets(normalizedAssets);
	assetPickerState.onPrimary = typeof options?.onPrimary === 'function' ? options.onPrimary : null;
	assetPickerState.primaryLabel = options?.primaryLabel || DEFAULT_PRIMARY_LABEL;
	assetPickerState.closeOnPrimary = options?.closeOnPrimary !== false;
	assetPickerState.isOpen = true;

	dom.title.textContent = options?.title || DEFAULT_TITLE;
	dom.subtitle.textContent = options?.subtitle || DEFAULT_SUBTITLE;
	dom.hint.textContent = options?.hint || DEFAULT_HINT;
	setButtonContent(dom.primaryButton, assetPickerState.primaryLabel, 'download');

	renderEntries();
	updateStatus();

	dom.wrapper.classList.add(VISIBLE_CLASS);
	dom.wrapper.setAttribute('aria-hidden', 'false');
	document.body.classList.add(BODY_OPEN_CLASS);
};

export const setupAssetPickerModal = () => {
	TTDB.assetPicker = TTDB.assetPicker || {};
	TTDB.assetPicker.open = openAssetPickerModal;
};
