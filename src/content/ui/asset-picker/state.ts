// Asset-picker state and shared model types.
//
// This file intentionally keeps mutable runtime state in one place so DOM, render,
// and event modules can stay focused and predictable.

export type PickerAsset = {
	id?: string;
	url: string;
	label?: string;
	meta?: string;
	thumbnailUrl?: string;
};

export type OpenAssetPickerOptions = {
	assets: PickerAsset[];
	title?: string;
	subtitle?: string;
	hint?: string;
	primaryLabel?: string;
	closeOnPrimary?: boolean;
	onPrimary?: (selectedAssets: PickerAsset[]) => void;
};

export type PickerEntry = {
	id: string;
	index: number;
	asset: PickerAsset;
};

export type AssetPickerDom = {
	wrapper: HTMLDivElement;
	backdrop: HTMLDivElement;
	panel: HTMLDivElement;
	title: HTMLHeadingElement;
	subtitle: HTMLParagraphElement;
	status: HTMLSpanElement;
	grid: HTMLDivElement;
	hint: HTMLParagraphElement;
	selectAllButton: HTMLButtonElement;
	clearAllButton: HTMLButtonElement;
	closeButton: HTMLButtonElement;
	cancelButton: HTMLButtonElement;
	primaryButton: HTMLButtonElement;
};

export const WRAPPER_CLASS = 'ttdb_asset-picker-wrapper';
export const VISIBLE_CLASS = 'is-visible';
export const BODY_OPEN_CLASS = 'ttdb_asset-picker-open';

export const DEFAULT_TITLE = 'Select assets';
export const DEFAULT_SUBTITLE = 'Choose the items you want. All are selected by default.';
export const DEFAULT_HINT = 'Select one or more assets, then continue.';
export const DEFAULT_PRIMARY_LABEL = 'Continue';

export const THUMB_SELECTOR = '.ttdb_asset-picker__thumb';

export const assetPickerState: {
	dom: AssetPickerDom | null;
	entries: PickerEntry[];
	selected: Set<string>;
	isOpen: boolean;
	keydownBound: boolean;
	domListenersBound: boolean;
	onPrimary: ((selectedAssets: PickerAsset[]) => void) | null;
	primaryLabel: string;
	closeOnPrimary: boolean;
} = {
	dom: null,
	entries: [],
	selected: new Set(),
	isOpen: false,
	keydownBound: false,
	domListenersBound: false,
	onPrimary: null,
	primaryLabel: DEFAULT_PRIMARY_LABEL,
	closeOnPrimary: true
};

export const normalizeAssets = (assets: PickerAsset[]) => {
	const seen = new Set<string>();
	const normalized: PickerAsset[] = [];

	(assets || []).forEach((asset) => {
		if (!asset || !asset.url) return;
		const url = String(asset.url).trim();
		if (!url || seen.has(url)) return;
		seen.add(url);
		normalized.push({ ...asset, url });
	});

	return normalized;
};

export const setEntriesFromAssets = (assets: PickerAsset[]) => {
	assetPickerState.entries = assets.map((asset, index) => ({
		id: asset.id || `asset-${index + 1}`,
		index: index + 1,
		asset
	}));

	assetPickerState.selected = new Set(assetPickerState.entries.map((entry) => entry.id));
};

export const getSelectedEntries = () => {
	return assetPickerState.entries.filter((entry) => assetPickerState.selected.has(entry.id));
};
