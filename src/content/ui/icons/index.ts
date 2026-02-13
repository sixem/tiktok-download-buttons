const SVG_NS = 'http://www.w3.org/2000/svg';

type SvgPathDefinition = {
	d: string;
	fillRule?: 'evenodd';
	clipRule?: 'evenodd';
	fill?: string;
	stroke?: string;
	strokeWidth?: string;
	strokeLinecap?: 'round' | 'square' | 'butt';
	strokeLinejoin?: 'round' | 'miter' | 'bevel';
};

const setOptionalAttribute = (node: Element, key: string, value?: string) => {
	if (!value) return;
	node.setAttribute(key, value);
};

const createIcon = (className: string, viewBox: string, paths: SvgPathDefinition[]) => {
	const svg = document.createElementNS(SVG_NS, 'svg');
	if (className) {
		svg.setAttribute('class', className);
	}

	svg.setAttribute('viewBox', viewBox);
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('focusable', 'false');

	paths.forEach((pathDefinition) => {
		const path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', pathDefinition.d);
		setOptionalAttribute(path, 'fill-rule', pathDefinition.fillRule);
		setOptionalAttribute(path, 'clip-rule', pathDefinition.clipRule);
		setOptionalAttribute(path, 'fill', pathDefinition.fill);
		setOptionalAttribute(path, 'stroke', pathDefinition.stroke);
		setOptionalAttribute(path, 'stroke-width', pathDefinition.strokeWidth);
		setOptionalAttribute(path, 'stroke-linecap', pathDefinition.strokeLinecap);
		setOptionalAttribute(path, 'stroke-linejoin', pathDefinition.strokeLinejoin);
		svg.appendChild(path);
	});

	return svg;
};

export const createIconCheck = (className = '') => createIcon(className, '0 0 24 24', [{
	d: 'M21.2287 6.60355C21.6193 6.99407 21.6193 7.62723 21.2287 8.01776L10.2559 18.9906C9.86788 19.3786 9.23962 19.3814 8.84811 18.9969L2.66257 12.9218C2.26855 12.5349 2.26284 11.9017 2.64983 11.5077L3.35054 10.7942C3.73753 10.4002 4.37067 10.3945 4.7647 10.7815L9.53613 15.4677L19.1074 5.89644C19.4979 5.50592 20.1311 5.50591 20.5216 5.89644L21.2287 6.60355Z',
	fillRule: 'evenodd',
	clipRule: 'evenodd',
	fill: 'currentColor'
}]);

export const createIconPlus = (className = '') => createIcon(className, '0 0 24 24', [{
	d: 'M13.5 3C13.5 2.44772 13.0523 2 12.5 2H11.5C10.9477 2 10.5 2.44772 10.5 3V10.5H3C2.44772 10.5 2 10.9477 2 11.5V12.5C2 13.0523 2.44772 13.5 3 13.5H10.5V21C10.5 21.5523 10.9477 22 11.5 22H12.5C13.0523 22 13.5 21.5523 13.5 21V13.5H21C21.5523 13.5 22 13.0523 22 12.5V11.5C22 10.9477 21.5523 10.5 21 10.5H13.5V3Z',
	fill: 'currentColor'
}]);

export const createIconDownload = (className = '') => createIcon(className, '0 0 24 24', [
	{
		d: 'M8.00003 11C7.59557 11 7.23093 11.2436 7.07615 11.6173C6.92137 11.991 7.00692 12.4211 7.29292 12.7071L11.2929 16.7071C11.6834 17.0976 12.3166 17.0976 12.7071 16.7071L16.7071 12.7071C16.9931 12.4211 17.0787 11.991 16.9239 11.6173C16.7691 11.2436 16.4045 11 16 11H13.5V3C13.5 2.44771 13.0523 2 12.5 2H11.5C10.9477 2 10.5 2.44772 10.5 3V11H8.00003Z',
		fill: 'currentColor'
	},
	{
		d: 'M20 19C20.5523 19 21 19.4477 21 20V21C21 21.5523 20.5523 22 20 22H4C3.44772 22 3 21.5523 3 21V20C3 19.4477 3.44772 19 4 19H20Z',
		fill: 'currentColor'
	}
]);

export const createIconReset = (className = '') => createIcon(className, '0 0 24 24', [{
	d: 'M7.62095 6.20695C8.81127 5.25458 10.2564 4.5 11.9998 4.5C16.1419 4.5 19.4998 7.85786 19.4998 12C19.4998 16.1421 16.1419 19.5 11.9998 19.5C8.74488 19.5 5.97175 17.4254 4.93515 14.5256C4.74925 14.0055 4.22477 13.6568 3.68448 13.7713L2.70621 13.9787C2.16592 14.0932 1.81614 14.6262 1.98184 15.1531C3.32107 19.4112 7.2982 22.5 11.9998 22.5C17.7987 22.5 22.4998 17.799 22.4998 12C22.4998 6.20101 17.7987 1.5 11.9998 1.5C9.21627 1.5 7.04815 2.76845 5.48857 4.07458L3.70689 2.29289C3.42089 2.00689 2.99077 1.92134 2.6171 2.07612C2.24342 2.2309 1.99978 2.59554 1.99978 3V8.5C1.99978 9.05228 2.4475 9.5 2.99978 9.5H8.49978C8.90424 9.5 9.26888 9.25636 9.42366 8.88268C9.57844 8.50901 9.49289 8.07889 9.20689 7.79289L7.62095 6.20695Z',
	fill: 'currentColor'
}]);

export const createIconClose = (className = '') => createIcon(className, '0 0 16 16', [{
	d: 'M0 14.545L1.455 16 8 9.455 14.545 16 16 14.545 9.455 8 16 1.455 14.545 0 8 6.545 1.455 0 0 1.455 6.545 8z',
	fillRule: 'evenodd',
	clipRule: 'evenodd',
	fill: 'currentColor'
}]);
