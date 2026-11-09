import { describe, expect, it } from 'vitest';
import { webDetailHelpers } from '@/content/api/web-detail';

describe('webDetailHelpers', () => {
	it('decodes escaped values from TikTok HTML payloads', () => {
		expect(webDetailHelpers.decodeEscapedValue('https:\\/\\/cdn.example.com\\/clip.mp4')).toBe(
			'https://cdn.example.com/clip.mp4'
		);
		expect(webDetailHelpers.decodeEscapedValue('https:\\u002F\\u002Fcdn.example.com\\u002Fclip.mp4')).toBe(
			'https://cdn.example.com/clip.mp4'
		);
	});

	it('extracts a video URL from raw HTML fallback payloads', () => {
		const html = '<script>{"playAddr":{"urlList":["https:\\u002F\\u002Fcdn.example.com\\u002Fvideo.mp4"]}}</script>';
		expect(webDetailHelpers.extractVideoUrlFromHtml(html)).toBe('https://cdn.example.com/video.mp4');
	});

	it('does not guess between media URLs from unrelated posts in one HTML page', () => {
		const html = '<script>{"playAddr":"https://cdn.example.com/a.mp4","downloadAddr":"https://cdn.example.com/b.mp4"}</script>';
		expect(webDetailHelpers.extractVideoUrlFromHtml(html)).toBeNull();
	});

	it('requires corroborating page metadata before using unscoped HTML fallbacks', () => {
		const doc = (canonical: string | null, og: string | null = null) => ({
			querySelector: (selector: string) => {
				const value = selector.startsWith('link') ? canonical : selector.includes('og:url') ? og : null;
				return value ? { getAttribute: () => value } : null;
			}
		});
		const url = 'https://www.tiktok.com/@creator/video/123';
		expect(webDetailHelpers.pageIdentifiesVideo(doc(url), '123', url)).toBe(true);
		expect(webDetailHelpers.pageIdentifiesVideo(doc(null), '123', url)).toBe(false);
		expect(webDetailHelpers.pageIdentifiesVideo(doc('https://www.tiktok.com/@creator/video/456'), '123', url)).toBe(false);
		expect(webDetailHelpers.pageIdentifiesVideo(doc(url, 'https://www.tiktok.com/@creator/video/456'), '123', url)).toBe(false);
		expect(webDetailHelpers.pageIdentifiesVideo(doc(url), '123', 'https://www.tiktok.com/@creator/video/456')).toBe(false);
		expect(webDetailHelpers.pageIdentifiesVideo(doc('https://example.com/@creator/video/123'), '123', url)).toBe(false);
	});

	it('extracts JSON-LD video metadata from graph entries', () => {
		const fakeDocument = {
			querySelectorAll: () => ([
				{
					textContent: JSON.stringify({
						'@graph': [
							{ '@type': 'BreadcrumbList' },
							{
								'@type': 'VideoObject',
								contentUrl: 'https://cdn.example.com/jsonld.mp4',
								name: 'Example title',
								description: 'Example description'
							}
						]
					})
				}
			])
		};

		expect(webDetailHelpers.extractJsonLdVideoInfo(fakeDocument as any)).toEqual({
			url: 'https://cdn.example.com/jsonld.mp4',
			title: 'Example title',
			description: 'Example description'
		});
	});

	it('returns null when no JSON-LD video entry is present', () => {
		const fakeDocument = {
			querySelectorAll: () => ([{ textContent: JSON.stringify({ '@type': 'Thing', name: 'No video' }) }])
		};

		expect(webDetailHelpers.extractJsonLdVideoInfo(fakeDocument as any)).toBeNull();
	});

	it('uses only JSON-LD that identifies the requested video, not a recommendation', () => {
		const fakeDocument = {
			querySelectorAll: () => [{ textContent: JSON.stringify({ '@graph': [
				{ '@type': 'VideoObject', url: 'https://www.tiktok.com/@other/video/222', contentUrl: 'https://cdn.example.com/other.mp4' },
				{ '@type': 'VideoObject', url: 'https://www.tiktok.com/@creator/video/111', contentUrl: 'https://cdn.example.com/correct.mp4' }
			] }) }]
		};
		expect(webDetailHelpers.extractJsonLdVideoInfo(fakeDocument as any, '111')?.url).toBe('https://cdn.example.com/correct.mp4');
		expect(webDetailHelpers.extractJsonLdVideoInfo(fakeDocument as any, '333')).toBeNull();
	});
});
