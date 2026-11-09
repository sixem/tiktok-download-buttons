type DomStyleValues = Record<string, string | number | null | undefined>;
type DomAttributeValues = Record<string, string | number | boolean | null | undefined>;

type PolygonSvgValues = {
	dimensions: [number, number];
	points: Array<string | number>;
	style?: DomStyleValues;
};

type CreateButtonValues = {
	class?: string;
	content?: false | ['textContent', string] | ['appendChild', Element];
	innerType?: keyof HTMLElementTagNameMap;
};

export const DOM = {
	createPolygonSvg: (values: PolygonSvgValues) => {
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
	setStyle: (element: HTMLElement | SVGElement, values: DomStyleValues) => {
		Object.keys(values).forEach((key) => {
			const value = values[key];
			if (value === null || value === undefined) return;
			element.style.setProperty(key, String(value));
		});
	},
	setAttributes: <T extends Element>(element: T, attributes: DomAttributeValues) => {
		Object.keys(attributes).forEach((key) => {
			const value = attributes[key];
			if (value === null || value === undefined) return;
			element.setAttribute(key, String(value));
		});

		return element;
	},
	multiSelector: (values: Record<string, string>) => {
		return Object.keys(values).map((key) => values[key]).join(', ');
	},
	selectorNamed: (values: Record<string, string>) => {
		const selected: Record<string, Element | null> = {};
		for (const [name, value] of Object.entries(values)) {
			selected[name] = document.querySelector(value) || null;
		}

		return selected;
	},
	createButton: (values: CreateButtonValues) => {
		const container = document.createElement('a');
		const inner = document.createElement(values.innerType ? values.innerType : 'span');

		if (values.content) {
			const [contentMode, content] = values.content || ['textContent', 'Download'];

			if (contentMode === 'appendChild' && content instanceof Element) {
				inner.appendChild(content);
			} else {
				inner.textContent = String(content);
			}
		}

		container.appendChild(inner);
		container.setAttribute('class', values.class || '');

		return container;
	}
};
