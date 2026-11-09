// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getStoredSetting: vi.fn(),
	resolveDownloadAttempt: vi.fn(),
	downloadViaDom: vi.fn()
}));

vi.mock('@/content/utils', () => ({
	clearButtonLoading: vi.fn(),
	startButtonLoading: vi.fn(),
	getRuntimeInfo: vi.fn(async () => ({ isChromium: true })),
	getStoredSetting: mocks.getStoredSetting,
	hashString: vi.fn()
}));
vi.mock('@/content/download/strategies', () => ({
	downloadViaApi: vi.fn(),
	downloadViaBlob: vi.fn(),
	downloadViaDom: mocks.downloadViaDom,
	downloadViaIntercept: vi.fn()
}));
vi.mock('@/content/download/state/preview-url-cache', () => ({
	armPreviewCapture: vi.fn(),
	getCachedPreviewUrl: vi.fn(() => null),
	waitForPreviewUrl: vi.fn()
}));
vi.mock('@/content/download/flow/resolve-download-attempt', () => ({
	resolveDownloadAttempt: mocks.resolveDownloadAttempt
}));

import { TTDB } from '@/content/core/state';
import { createDownloadClickHandler } from '@/content/download/flow/download-click-handler';

describe('download click handling', () => {
	it('uses the clicked video after the viewer navigates while settings load', async () => {
		let resume: (value: string) => void = () => {};
		mocks.getStoredSetting.mockReturnValue(new Promise<string>((resolve) => { resume = resolve; }));
		mocks.resolveDownloadAttempt.mockImplementation(async ({ candidates }) => ({
			videoUrl: candidates.domVideoUrl,
			filename: 'first.mp4',
			source: 'dom',
			needsPreviewWait: false,
			blockedReason: null
		}));
		mocks.downloadViaDom.mockReset();
		TTDB.LOG = { ns: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) } as any;

		const article = document.createElement('article');
		const video = document.createElement('video');
		video.src = 'https://cdn.example.com/first.mp4';
		article.append(video);
		const button = document.createElement('a');
		button.className = 'ttdb__button_browser';
		button.ttdbItem = article;
		button.setAttribute('video-id', '111');
		button.setAttribute('filename', 'first.mp4');
		const firstPage = 'https://www.tiktok.com/@first/video/111';
		const secondPage = 'https://www.tiktok.com/@second/video/222';
		const handler = createDownloadClickHandler(button, { id: '111', user: 'first', url: null, videoApiId: '111', pageUrl: firstPage });
		const pending = handler(new MouseEvent('click'));

		video.src = 'https://cdn.example.com/second.mp4';
		button.setAttribute('video-id', '222');
		button.setAttribute('data-video-page-url', secondPage);
		resume('{id}');
		await pending;

		expect(mocks.resolveDownloadAttempt).toHaveBeenCalledWith(expect.objectContaining({
			attrs: expect.objectContaining({ apiId: '111', pageUrl: firstPage }),
			candidates: expect.objectContaining({ domVideoUrl: 'https://cdn.example.com/first.mp4' })
		}));
		expect(mocks.downloadViaDom).toHaveBeenCalledWith('https://cdn.example.com/first.mp4', 'first.mp4', button, expect.any(Number), expect.any(Object));
		expect(button.getAttribute('data-video-page-url')).toBe(secondPage);
	});
});
