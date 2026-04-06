// Small shared hashing helpers.
//
// Keep these tiny and explicit so repeated ID-generation code can share one
// implementation without introducing a heavy abstraction layer.

export const hashString = (input: string | null | undefined) => {
	if (!input) return null;

	return String(input)
		.split('')
		.reduce((hash, char) => (hash * 33) ^ char.charCodeAt(0), 5381) >>> 0;
};
