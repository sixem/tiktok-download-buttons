// Asset-picker DOM creation helpers.
//
// This module creates the static modal scaffold once and reuses it for subsequent opens.

import {
	createIconCheck,
	createIconClose,
	createIconDownload,
	createIconPlus,
	createIconReset
} from '../icons';
import {
	assetPickerState,
	type AssetPickerDom,
	DEFAULT_HINT,
	DEFAULT_PRIMARY_LABEL,
	DEFAULT_SUBTITLE,
	DEFAULT_TITLE,
	WRAPPER_CLASS
} from './state';

const ICON_BUILDERS = {
	check: createIconCheck,
	close: createIconClose,
	download: createIconDownload,
	plus: createIconPlus,
	reset: createIconReset
};

type ModalIconName = keyof typeof ICON_BUILDERS;

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

export const setButtonContent = (button: HTMLButtonElement, label: string, iconName: ModalIconName) => {
	button.textContent = '';

	const iconClassName = iconName === 'close'
		? 'ttdb_asset-picker__buttonIcon ttdb_asset-picker__buttonIcon--close'
		: 'ttdb_asset-picker__buttonIcon';
	const icon = createIcon(iconClassName, iconName);
	const text = createNode<HTMLSpanElement>('span', 'ttdb_asset-picker__buttonText', label);
	button.appendChild(icon);
	button.appendChild(text);
};

export const ensureAssetPickerDom = (): AssetPickerDom => {
	if (assetPickerState.dom && assetPickerState.dom.wrapper.isConnected) {
		return assetPickerState.dom;
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

	assetPickerState.dom = {
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

	// New DOM instance means listeners must be re-attached.
	assetPickerState.domListenersBound = false;
	return assetPickerState.dom;
};
