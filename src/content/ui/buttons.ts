import { DOM } from '../dom';
import {
	createIconDownloadArrow,
	createIconDownloadList
} from './icons';

type DownloadIconVariant = 'regular' | 'list';

const createDownloadIcon = (variant: DownloadIconVariant, className: string) => {
	return variant === 'list'
		? createIconDownloadList(className)
		: createIconDownloadArrow(className);
};

const setFeedButtonIconVariant = (button: HTMLElement, variant: DownloadIconVariant) => {
	const inner = button.querySelector(':scope > div');
	if (!inner) return;

	inner.textContent = '';
	inner.appendChild(createDownloadIcon(variant, 'ttdb__button_feed-icon'));
};

const setBrowserButtonIconVariant = (button: HTMLElement, variant: DownloadIconVariant) => {
	const icon = createDownloadIcon(variant, 'ttdb__button_browser-icon');
	const inner = button.querySelector<HTMLElement>(':scope > span.ttdb__button_browser-inner');
	if (!inner) return;

	const existing = inner.querySelector(':scope > svg.ttdb__button_browser-icon');
	if (existing) {
		existing.replaceWith(icon);
		return;
	}

	inner.appendChild(icon);
};

export const setDownloadButtonIconVariant = (button: HTMLElement, variant: DownloadIconVariant) => {
	if (!button) return;

	if (button.classList.contains('ttdb__button_feed')) {
		setFeedButtonIconVariant(button, variant);
		return;
	}

	if (button.classList.contains('ttdb__button_browser')) {
		setBrowserButtonIconVariant(button, variant);
	}
};

const createBrowserButtonInner = () => {
	const inner = document.createElement('span');
	inner.className = 'ttdb__button_browser-inner';

	const label = document.createElement('span');
	label.className = 'ttdb__button_browser-text';
	label.textContent = 'Download';

	inner.appendChild(label);
	inner.appendChild(createDownloadIcon('regular', 'ttdb__button_browser-icon'));

	return inner;
};

const createBrowserButton = () => {
	const button = document.createElement('a');
	button.className = 'ttdb__button_browser';
	button.appendChild(createBrowserButtonInner());
	return button;
};

export const createButton = {
	BASIC_PLAYER: () => {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ttdb__button_basic-player_wrapper');

		const button = DOM.createButton({
			content: ['textContent', 'Download'],
			class: 'ttdb__button_basic-player'
		});

		DOM.setStyle(button, {
			border: '1px solid rgba(254, 44, 85, 1.0)',
			'background-color': 'rgba(254, 44, 85, 0.08)'
		});

		wrapper.appendChild(button);
		return wrapper;
	},
	BROWSER: () => {
		return createBrowserButton();
	},
	FEED: () => {
		return DOM.createButton({
			content: ['appendChild', createDownloadIcon('regular', 'ttdb__button_feed-icon')],
			innerType: 'div',
			class: 'ttdb__button_feed'
		});
	},
	GRID: () => {
		return DOM.createButton({
			content: false,
			class: 'ttdb__button_grid'
		});
	}
};

