import { describe, expect, it } from 'vitest';
import { getFileNameTemplate } from '@/content/download/filename';

describe('getFileNameTemplate', () => {
	it('replaces repeated tokens and appends .mp4 when needed', () => {
		const filename = getFileNameTemplate(
			{ user: 'creator', description: 'clip', videoApiId: '123' },
			{},
			'{uploader} - {id} - {uploader}'
		);

		expect(filename).toBe('creator - 123 - creator.mp4');
	});

	it('uses nested API fields when direct data is missing', () => {
		const filename = getFileNameTemplate(
			{},
			{
				author: {
					uniqueId: 'nested-user'
				},
				desc: 'from-api'
			},
			'{uploader} - {desc}'
		);

		expect(filename).toBe('nested-user - from-api.mp4');
	});

	it('uses local metadata when API fields are null or empty', () => {
		const filename = getFileNameTemplate(
			{ user: 'creator', description: 'local caption', videoApiId: '123' },
			{ author: { uniqueId: '  ' }, desc: null },
			'{uploader} - {desc}'
		);
		expect(filename).toBe('creator - local caption.mp4');
	});

	it('builds timestamp helper tokens from integer-like strings', () => {
		const filename = getFileNameTemplate(
			{},
			{
				createTime: '8'
			},
			'{uploaded_s}'
		);

		expect(filename).toBe('19700101_010008.mp4');
	});

	it('returns null when unresolved placeholders leave no usable filename', () => {
		expect(getFileNameTemplate({}, {}, '{missing}')).toBeNull();
		expect(getFileNameTemplate({}, {}, '{uploader} - {id}')).toBeNull();
		expect(getFileNameTemplate({}, {}, '???')).toBeNull();
	});

	it('uses the post URL for the username and ID when API metadata is missing', () => {
		const data = { user: 'Display name', pageUrl: 'https://www.tiktok.com/@creator/video/7234567890123456789' };
		expect(getFileNameTemplate(data, {}, '{uploader} - {id}')).toBe('creator - 7234567890123456789.mp4');
	});

	it('keeps available metadata when another placeholder is missing', () => {
		const data = { user: 'creator', videoApiId: '123' };
		expect(getFileNameTemplate(data, {}, '{uploader} - {desc} - {id}')).toBe('creator - 123.mp4');
		expect(getFileNameTemplate(data, {}, '{uploader} - {uploaded}')).toBe('creator.mp4');
	});

	it('keeps an existing extension regardless of case', () => {
		expect(getFileNameTemplate({ user: 'creator' }, {}, '{uploader}.MP4')).toBe('creator.MP4');
	});

	it('ignores non-TikTok URLs when looking for post metadata', () => {
		const data = { user: 'creator', pageUrl: 'https://example.com/@other/video/123' };
		expect(getFileNameTemplate(data, {}, '{uploader} - {id}')).toBe('creator.mp4');
	});
});
