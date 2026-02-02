import { DOM } from '../dom';

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
		return DOM.createButton({
			content: ['textContent', 'Download'],
			class: 'ttdb__button_browser'
		});
	},
	FEED: () => {
		return DOM.createButton({
			content: ['appendChild', DOM.createPolygonSvg({
				dimensions: [24, 24],
				points: [
					'13', '17.586', '13', '4', '11', '4',
					'11', '17.586', '4.707', '11.293', '3.293',
					'12.707', '12', '21.414', '20.707', '12.707',
					'19.293', '11.293', '13', '17.586'
				]
			})],
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

