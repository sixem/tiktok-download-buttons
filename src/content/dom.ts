export const DOM = {
	createPolygonSvg: (values) => {
		const w3Url = 'http://www.w3.org/2000/svg';
		const [width, height] = values.dimensions;

		const elementSvg = document.createElementNS(w3Url, 'svg');
		const elementPolygon = document.createElementNS(w3Url, 'polygon');

		DOM.setAttributes(elementSvg, {
			width,
			height,
			viewBox: `0 0 ${width} ${height}`
		});

		elementPolygon.setAttribute('points', values.points.join(' '));
		elementSvg.appendChild(elementPolygon);

		if (values.style) {
			DOM.setStyle(elementSvg, values.style);
		}

		return elementSvg;
	},
	setStyle: (element, values) => {
		Object.keys(values).forEach((key) => {
			element.style[key] = values[key];
		});
	},
	setAttributes: (element, attributes) => {
		Object.keys(attributes).forEach((key) => {
			element.setAttribute(key, attributes[key]);
		});

		return element;
	},
	multiSelector: (values) => {
		return Object.keys(values).map((key) => values[key]).join(', ');
	},
	selectorNamed: (values) => {
		for (const [name, value] of Object.entries(values)) {
			values[name] = document.querySelector(value) || null;
		}

		return values;
	},
	createButton: (values) => {
		const container = document.createElement('a');
		const inner = document.createElement(values.innerType ? values.innerType : 'span');

		if (values.content) {
			const [contentMode, content] = values.content || ['textContent', 'Download'];

			if (content instanceof Element) {
				inner[contentMode](content);
			} else {
				inner[contentMode] = content;
			}
		}

		container.appendChild(inner);
		container.setAttribute('class', values.class || '');

		return container;
	}
};
