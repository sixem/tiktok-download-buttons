// Shared URL helpers for content scripts.
//
// Keep these narrow and predictable so feature modules can reuse the same
// normalization and protocol checks without re-implementing them.

export const isHttpUrl = (value: string | null) => !!value && /^https?:/i.test(value);
export const isBlobUrl = (value: string | null) => !!value && value.startsWith('blob:');
export const isDataUrl = (value: string | null) => !!value && value.startsWith('data:');

export const normalizeUrl = (
	value: string | null | undefined,
	{
		base = window.location.origin,
		decode = false
	}: {
		base?: string;
		decode?: boolean;
	} = {}
) => {
	if (!value) return null;

	const trimmed = String(value).trim();
	if (!trimmed) return null;

	let normalized = trimmed;
	if (decode) {
		try {
			normalized = decodeURIComponent(trimmed);
		} catch (_) {
			normalized = trimmed;
		}
	}

	if (normalized.startsWith('//')) {
		return `https:${normalized}`;
	}

	if (normalized.startsWith('/')) {
		try {
			return new URL(normalized, base).href;
		} catch (_) {
			return normalized;
		}
	}

	try {
		return new URL(normalized, base).href;
	} catch (_) {
		return normalized;
	}
};
