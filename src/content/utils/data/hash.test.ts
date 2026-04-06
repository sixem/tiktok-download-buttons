import { describe, expect, it } from 'vitest';
import { hashString } from '@/content/utils/data/hash';

describe('hashString', () => {
	it('returns null for empty input', () => {
		expect(hashString('')).toBeNull();
		expect(hashString(null)).toBeNull();
		expect(hashString(undefined)).toBeNull();
	});

	it('is deterministic for the same input', () => {
		expect(hashString('video-123')).toBe(hashString('video-123'));
	});

	it('produces different hashes for different values', () => {
		expect(hashString('video-123')).not.toBe(hashString('video-124'));
	});
});
