// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ click: vi.fn() }));
vi.mock('@/content/download/flow/download-click-handler', () => ({
	createDownloadClickHandler: (_button: HTMLElement, data: unknown) => () => mocks.click(data)
}));
vi.mock('@/content/download/flow/preview-button-interactivity', () => ({
	setupPreviewButtonInteractivity: vi.fn()
}));

import { downloadHook } from '@/content/download/flow/download-hook';

describe('downloadHook', () => {
	afterEach(() => window.history.replaceState({}, '', '/'));

	it('uses the current post URL when its ID matches the button', async () => {
		window.history.replaceState({}, '', '/@creator/video/123');
		const button = document.createElement('a');
		await downloadHook(button, { id: 1700000000000, user: null, url: null, videoApiId: '123' });
		expect(button.getAttribute('filename')).toBe('creator - 123.mp4');
		expect(button.getAttribute('data-video-page-url')).toBe('https://www.tiktok.com/@creator/video/123');
	});

	it('does not use the current URL for a different video', async () => {
		window.history.replaceState({}, '', '/@other/video/222');
		const button = document.createElement('a');
		await downloadHook(button, { id: '123', user: 'creator', url: null, videoApiId: '123' });
		expect(button.getAttribute('filename')).toBe('creator - 123.mp4');
		expect(button.hasAttribute('data-video-page-url')).toBe(false);
	});

	it('prefers the video ID to a caption or generated timestamp in the fallback filename', async () => {
		const button = document.createElement('a');
		await downloadHook(button, { id: 'a caption', user: 'creator', url: null, videoApiId: '123' });
		expect(button.getAttribute('filename')).toBe('creator - 123.mp4');
		await downloadHook(button, { id: 1700000000000, user: 'creator', url: null });
		expect(button.getAttribute('filename')).toBe('creator - video.mp4');
	});

	it('uses the latest post when a viewer reuses its button', async () => {
		mocks.click.mockReset();
		const button = document.createElement('a');
		const first = { id: '111', user: 'first', url: null, videoApiId: '111', pageUrl: 'https://www.tiktok.com/@first/video/111' };
		const second = { id: '222', user: 'second', url: null, videoApiId: '222', pageUrl: 'https://www.tiktok.com/@second/video/222' };
		await downloadHook(button, first);
		await downloadHook(button, second);
		button.click();
		expect(mocks.click).toHaveBeenCalledOnce();
		expect(mocks.click).toHaveBeenCalledWith(second);
		expect(button.getAttribute('video-id')).toBe('222');
		expect(button.getAttribute('data-video-page-url')).toBe(second.pageUrl);
	});

	it('clears old identifying attributes when the next post lacks them', async () => {
		const button = document.createElement('a');
		await downloadHook(button, { id: '111', user: 'first', url: null, videoApiId: '111', pageUrl: 'https://www.tiktok.com/@first/video/111' });
		await downloadHook(button, { id: 'other', user: null, url: null });
		expect(button.hasAttribute('video-id')).toBe(false);
		expect(button.hasAttribute('data-video-page-url')).toBe(false);
	});
});
