// Reusable asset-picker modal.
//
// This component is intentionally domain-agnostic:
// - callers provide the assets and labels
// - the modal handles selection state and presentation
// - primary action wiring is optional
import { TTDB, SPLASH } from '../state';
import {
	createIconCheck,
	createIconClose,
	createIconDownload,
	createIconPlus,
	createIconReset
} from './icons';

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

type PickerEntry = {
	id: string;
	index: number;
	asset: PickerAsset;
};

type AssetPickerDom = {
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

const WRAPPER_CLASS = 'ttdb_asset-picker-wrapper';
const VISIBLE_CLASS = 'is-visible';
const BODY_OPEN_CLASS = 'ttdb_asset-picker-open';

const DEFAULT_TITLE = 'Select assets';
const DEFAULT_SUBTITLE = 'Choose the items you want. All are selected by default.';
const DEFAULT_HINT = 'Select one or more assets, then continue.';
const DEFAULT_PRIMARY_LABEL = 'Continue';

const ICON_BUILDERS = {
	check: createIconCheck,
	close: createIconClose,
	download: createIconDownload,
	plus: createIconPlus,
	reset: createIconReset
};

type ModalIconName = keyof typeof ICON_BUILDERS;

const state: {
	dom: AssetPickerDom | null;
	entries: PickerEntry[];
	selected: Set<string>;
	isOpen: boolean;
	keydownBound: boolean;
	onPrimary: ((selectedAssets: PickerAsset[]) => void) | null;
	primaryLabel: string;
	closeOnPrimary: boolean;
} = {
	dom: null,
	entries: [],
	selected: new Set(),
	isOpen: false,
	keydownBound: false,
	onPrimary: null,
	primaryLabel: DEFAULT_PRIMARY_LABEL,
	closeOnPrimary: true
};

const createNode = <T extends HTMLElement>(tag: string, className: string, text = '') => {
	const node = document.createElement(tag) as T;
	node.className = className;
	if (text) {
		node.textContent = text;
	}
	return node;
};

const createIcon = (className: string, iconName: ModalIconName) => {
	return ICON_BUILDERS[iconName](className);
};

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

const setButtonContent = (button: HTMLButtonElement, label: string, iconName: ModalIconName) => {
	button.textContent = '';

	const iconClassName = iconName === 'close'
		? 'ttdb_asset-picker__buttonIcon ttdb_asset-picker__buttonIcon--close'
		: 'ttdb_asset-picker__buttonIcon';
	const icon = createIcon(iconClassName, iconName);
	const text = createNode<HTMLSpanElement>('span', 'ttdb_asset-picker__buttonText', label);
	button.appendChild(icon);
	button.appendChild(text);
};

const closeAssetPickerModal = () => {
	const dom = state.dom;
	if (!dom) return;

	state.isOpen = false;
	dom.wrapper.classList.remove(VISIBLE_CLASS);
	dom.wrapper.setAttribute('aria-hidden', 'true');
	document.body.classList.remove(BODY_OPEN_CLASS);
};

const getSelectedEntries = () => {
	return state.entries.filter((entry) => state.selected.has(entry.id));
};

const setThumbSelectedState = (thumb: HTMLElement, selected: boolean) => {
	thumb.classList.toggle('is-selected', selected);
	thumb.setAttribute('aria-pressed', selected ? 'true' : 'false');
};

const setAllThumbsSelectedState = (selected: boolean) => {
	const dom = state.dom;
	if (!dom) return;

	dom.grid.querySelectorAll<HTMLElement>('.ttdb_asset-picker__thumb').forEach((thumb) => {
		setThumbSelectedState(thumb, selected);
	});
};

const updateStatus = () => {
	const dom = state.dom;
	if (!dom) return;

	const total = state.entries.length;
	const selectedCount = state.selected.size;
	const allSelected = total > 0 && selectedCount === total;
	const noneSelected = selectedCount === 0;

	dom.status.textContent = `${selectedCount}/${total} selected`;
	dom.selectAllButton.disabled = total === 0 || allSelected;
	dom.clearAllButton.disabled = total === 0 || noneSelected;
	dom.primaryButton.disabled = total === 0 || noneSelected;
	const primaryLabel = total > 0
		? `${state.primaryLabel} (${selectedCount})`
		: state.primaryLabel;
	setButtonContent(dom.primaryButton, primaryLabel, 'download');
};

const renderEntries = () => {
	const dom = state.dom;
	if (!dom) return;

	dom.grid.textContent = '';

	state.entries.forEach((entry, idx) => {
		const label = entry.asset.label || `Item ${entry.index}`;
		const thumb = createNode<HTMLButtonElement>('button', 'ttdb_asset-picker__thumb is-selected is-loading');
		thumb.type = 'button';
		thumb.draggable = false;
		thumb.setAttribute('aria-pressed', 'true');
		thumb.setAttribute('aria-label', `Toggle ${label}`);
		thumb.style.setProperty('--ttdb-thumb-delay', `${Math.min(idx * 28, 280)}ms`);

		const check = createNode<HTMLSpanElement>('span', 'ttdb_asset-picker__check');
		check.appendChild(createIcon('ttdb_asset-picker__checkIcon', 'check'));

		const indexTag = createNode<HTMLSpanElement>('span', 'ttdb_asset-picker__index', String(entry.index));

		const img = document.createElement('img');
		img.className = 'ttdb_asset-picker__image';
		img.loading = 'lazy';
		img.decoding = 'async';
		img.draggable = false;
		img.alt = label;
		img.src = entry.asset.thumbnailUrl || entry.asset.url;

		const meta = createNode<HTMLSpanElement>('span', 'ttdb_asset-picker__meta', entry.asset.meta || label);

		img.addEventListener('load', () => {
			thumb.classList.remove('is-loading');
			thumb.classList.add('is-loaded');
		});

		img.addEventListener('error', () => {
			thumb.classList.remove('is-loading');
			thumb.classList.add('is-error');
		});

		thumb.addEventListener('click', () => {
			if (state.selected.has(entry.id)) {
				state.selected.delete(entry.id);
				setThumbSelectedState(thumb, false);
			} else {
				state.selected.add(entry.id);
				setThumbSelectedState(thumb, true);
			}

			updateStatus();
		});

		thumb.appendChild(check);
		thumb.appendChild(indexTag);
		thumb.appendChild(img);
		thumb.appendChild(meta);
		dom.grid.appendChild(thumb);
	});
};

const attachDomListeners = (dom: AssetPickerDom) => {
	dom.closeButton.addEventListener('click', () => closeAssetPickerModal());
	dom.cancelButton.addEventListener('click', () => closeAssetPickerModal());
	dom.backdrop.addEventListener('click', () => closeAssetPickerModal());

	dom.selectAllButton.addEventListener('click', () => {
		state.selected = new Set(state.entries.map((entry) => entry.id));
		setAllThumbsSelectedState(true);
		updateStatus();
	});

	dom.clearAllButton.addEventListener('click', () => {
		state.selected.clear();
		setAllThumbsSelectedState(false);
		updateStatus();
	});

	dom.primaryButton.addEventListener('click', () => {
		const selectedAssets = getSelectedEntries().map((entry) => entry.asset);
		if (!selectedAssets.length) return;

		if (typeof state.onPrimary === 'function') {
			const onPrimary = state.onPrimary;
			if (state.closeOnPrimary) {
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
	});

	if (!state.keydownBound) {
		window.addEventListener('keydown', (e) => {
			if (!state.isOpen) return;
			if (e.key !== 'Escape') return;

			e.preventDefault();
			closeAssetPickerModal();
		});

		state.keydownBound = true;
	}
};

const ensureModalDom = () => {
	if (state.dom && state.dom.wrapper.isConnected) {
		return state.dom;
	}

	const wrapper = createNode<HTMLDivElement>('div', WRAPPER_CLASS);
	wrapper.setAttribute('aria-hidden', 'true');

	const backdrop = createNode<HTMLDivElement>('div', 'ttdb_asset-picker__backdrop');
	const panel = createNode<HTMLDivElement>('div', 'ttdb_asset-picker__panel');

	const header = createNode<HTMLDivElement>('div', 'ttdb_asset-picker__header');
	const heading = createNode<HTMLDivElement>('div', 'ttdb_asset-picker__heading');
	const title = createNode<HTMLHeadingElement>('h3', 'ttdb_asset-picker__title', DEFAULT_TITLE);
	const subtitle = createNode<HTMLParagraphElement>('p', 'ttdb_asset-picker__subtitle', DEFAULT_SUBTITLE);
	const closeButton = createNode<HTMLButtonElement>('button', 'ttdb_asset-picker__close', '');
	closeButton.type = 'button';
	closeButton.setAttribute('aria-label', 'Close picker');
	closeButton.textContent = '';
	closeButton.appendChild(createIcon('ttdb_asset-picker__closeIcon', 'close'));
	heading.appendChild(title);
	heading.appendChild(subtitle);
	header.appendChild(heading);
	header.appendChild(closeButton);

	const controls = createNode<HTMLDivElement>('div', 'ttdb_asset-picker__controls');
	const status = createNode<HTMLSpanElement>('span', 'ttdb_asset-picker__status', '0/0 selected');
	const controlButtons = createNode<HTMLDivElement>('div', 'ttdb_asset-picker__control-buttons');
	const selectAllButton = createNode<HTMLButtonElement>('button', 'ttdb_asset-picker__ghost', 'Select all');
	const clearAllButton = createNode<HTMLButtonElement>('button', 'ttdb_asset-picker__ghost', 'Clear');
	selectAllButton.type = 'button';
	clearAllButton.type = 'button';
	setButtonContent(selectAllButton, 'Select all', 'plus');
	setButtonContent(clearAllButton, 'Clear', 'reset');
	controlButtons.appendChild(selectAllButton);
	controlButtons.appendChild(clearAllButton);
	controls.appendChild(status);
	controls.appendChild(controlButtons);

	const grid = createNode<HTMLDivElement>('div', 'ttdb_asset-picker__grid');

	const footer = createNode<HTMLDivElement>('div', 'ttdb_asset-picker__footer');
	const hint = createNode<HTMLParagraphElement>('p', 'ttdb_asset-picker__hint', DEFAULT_HINT);
	const footerActions = createNode<HTMLDivElement>('div', 'ttdb_asset-picker__footer-actions');
	const cancelButton = createNode<HTMLButtonElement>('button', 'ttdb_asset-picker__ghost', 'Close');
	const primaryButton = createNode<HTMLButtonElement>('button', 'ttdb_asset-picker__primary', DEFAULT_PRIMARY_LABEL);
	cancelButton.type = 'button';
	primaryButton.type = 'button';
	setButtonContent(cancelButton, 'Close', 'close');
	setButtonContent(primaryButton, DEFAULT_PRIMARY_LABEL, 'download');
	footerActions.appendChild(cancelButton);
	footerActions.appendChild(primaryButton);
	footer.appendChild(hint);
	footer.appendChild(footerActions);

	panel.appendChild(header);
	panel.appendChild(controls);
	panel.appendChild(grid);
	panel.appendChild(footer);

	wrapper.appendChild(backdrop);
	wrapper.appendChild(panel);
	document.body.appendChild(wrapper);

	state.dom = {
		wrapper,
		backdrop,
		panel,
		title,
		subtitle,
		status,
		grid,
		hint,
		selectAllButton,
		clearAllButton,
		closeButton,
		cancelButton,
		primaryButton
	};

	attachDomListeners(state.dom);
	return state.dom;
};

const normalizeAssets = (assets: PickerAsset[]) => {
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

export const openAssetPickerModal = (options: OpenAssetPickerOptions) => {
	const dom = ensureModalDom();
	const normalizedAssets = normalizeAssets(options?.assets || []);

	if (!normalizedAssets.length) {
		// Keep this intentionally light: callers may decide whether "no assets" is expected.
		dom.hint.textContent = 'No assets were found for this picker.';
		return;
	}

	state.entries = normalizedAssets.map((asset, index) => ({
		id: asset.id || `asset-${index + 1}`,
		index: index + 1,
		asset
	}));
	state.selected = new Set(state.entries.map((entry) => entry.id));
	state.onPrimary = typeof options?.onPrimary === 'function' ? options.onPrimary : null;
	state.primaryLabel = options?.primaryLabel || DEFAULT_PRIMARY_LABEL;
	state.closeOnPrimary = options?.closeOnPrimary !== false;
	state.isOpen = true;

	dom.title.textContent = options?.title || DEFAULT_TITLE;
	dom.subtitle.textContent = options?.subtitle || DEFAULT_SUBTITLE;
	dom.hint.textContent = options?.hint || DEFAULT_HINT;
	setButtonContent(dom.primaryButton, state.primaryLabel, 'download');

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

// Backwards-compatible helpers while we migrate call-sites.
export const openSlideshowModal = (imageUrls: string[]) => {
	openAssetPickerModal({
		assets: (imageUrls || []).map((url, index) => ({
			id: `image-${index + 1}`,
			url,
			label: `Image ${index + 1}`
		})),
		title: 'Select images',
		subtitle: 'Choose the slides you want. All are selected by default.',
		primaryLabel: 'Download selected',
		hint: DEFAULT_HINT
	});
};

export const setupSlideshowModal = () => {
	setupAssetPickerModal();
};


