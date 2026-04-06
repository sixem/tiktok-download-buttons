// Small DOM type guards shared across content modules.
//
// These helpers keep DOM-heavy files readable and make repeated narrowing
// intent obvious at the call-site.

export const isNode = (value: unknown): value is Node => {
	return !!value && typeof value === 'object' && 'nodeType' in (value as any);
};

export const isElement = (node: Node | null): node is Element => {
	return !!node && node.nodeType === Node.ELEMENT_NODE;
};

export const isParentNode = (node: Node | null): node is ParentNode => {
	return !!node && typeof (node as ParentNode).querySelectorAll === 'function';
};

export const isQueryable = (root: unknown): root is ParentNode => {
	return !!root && typeof (root as ParentNode).querySelector === 'function';
};
