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
});
