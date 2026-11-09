// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TTDB } from '@/content/core/state';
import { getFileNameTemplate } from '@/content/download/filename';
import { extractBrowserData } from '@/content/item-data/browser';
import { extractFeedData } from '@/content/item-data/feed';

vi.mock('@/content/extractors/share', () => ({ findVideoUrls: () => false }));

describe('caption metadata for naming', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		TTDB.LOG = { info: vi.fn() };
	});

	it('uses the current feed caption when API metadata is unavailable', () => {
		document.body.innerHTML = '<article><a href="/@creator">Creator</a><div data-e2e="video-desc">A lovely <span>clip</span></div></article>';
		const article = document.querySelector('article') as HTMLElement;
		const data = extractFeedData({ container: article, env: TTDB.ENV.APP });
		expect(getFileNameTemplate(data, {}, '{uploader} - {desc}')).toBe('creator - A lovely clip.mp4');
	});

	it('keeps the viewer caption scoped to its own post', () => {
		document.body.innerHTML = '<div id="other"><div data-e2e="browse-video-desc">Wrong post</div></div><div id="viewer"><div id="xgwrapper-0-123"></div><div data-e2e="browse-video-desc">Right post</div></div>';
		const viewer = document.querySelector('#viewer') as HTMLElement;
		const data = extractBrowserData({ container: viewer, env: TTDB.ENV.APP });
		expect(data.description).toBe('Right post');
		expect(data.videoApiId).toBe('123');
	});

	it('does not borrow a caption from another item', () => {
		document.body.innerHTML = '<div data-e2e="video-desc">Other caption</div><article></article>';
		const article = document.querySelector('article') as HTMLElement;
		expect(extractFeedData({ container: article, env: TTDB.ENV.APP }).description).toBeUndefined();
	});
});
