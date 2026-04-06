import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TTDB } from '@/content/core/state';
import { setupObjectUtils } from '@/content/utils/data/object';
import { getFileNameTemplate } from '@/content/download/filename';

describe('getFileNameTemplate', () => {
	beforeEach(() => {
		setupObjectUtils();
		TTDB.LOG = {
			info: vi.fn()
		};
	});

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
	});
});
