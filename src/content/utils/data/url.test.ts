import { describe, expect, it } from 'vitest';
import { isBlobUrl, isDataUrl, isHttpUrl, normalizeUrl } from '@/content/utils/data/url';

describe('url helpers', () => {
	it('detects basic URL families', () => {
		expect(isHttpUrl('https://example.com')).toBe(true);
		expect(isHttpUrl('blob:123')).toBe(false);
		expect(isBlobUrl('blob:123')).toBe(true);
		expect(isDataUrl('data:text/plain,hello')).toBe(true);
	});

	it('normalizes protocol-relative URLs to https', () => {
		expect(normalizeUrl('//cdn.example.com/video.mp4', {
			base: 'https://www.tiktok.com'
		})).toBe('https://cdn.example.com/video.mp4');
	});

	it('resolves root-relative URLs against the provided base', () => {
		expect(normalizeUrl('/video/123', {
			base: 'https://www.tiktok.com/@creator'
		})).toBe('https://www.tiktok.com/video/123');
	});

	it('decodes URLs when requested', () => {
		expect(normalizeUrl('https%3A%2F%2Fcdn.example.com%2Fclip.mp4', {
			base: 'https://www.tiktok.com',
			decode: true
		})).toBe('https://cdn.example.com/clip.mp4');
	});

	it('falls back to the original value when decoding fails', () => {
		expect(normalizeUrl('%E0%A4%A', {
			base: 'https://example.com',
			decode: true
		})).toBe('https://example.com/%E0%A4%A');
	});

	it('returns null for empty values', () => {
		expect(normalizeUrl('   ', {
			base: 'https://example.com'
		})).toBeNull();
		expect(normalizeUrl(null, {
			base: 'https://example.com'
		})).toBeNull();
	});
});
