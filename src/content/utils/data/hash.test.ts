import { describe, expect, it } from 'vitest';
import { hashString } from '@/content/utils/data/hash';

describe('hashString', () => {
	it('returns null for empty input', () => {
		expect(hashString('')).toBeNull();
		expect(hashString(null)).toBeNull();
		expect(hashString(undefined)).toBeNull();
	});
});
