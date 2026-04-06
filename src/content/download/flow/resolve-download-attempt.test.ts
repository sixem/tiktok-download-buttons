import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getWebApiDataMock: vi.fn(),
	getItemDetailApiDataMock: vi.fn(),
	getFileNameTemplateMock: vi.fn()
}));

vi.mock('@/content/api/web-detail', () => ({
	getWebApiData: mocks.getWebApiDataMock
}));

vi.mock('@/content/api/item-detail', () => ({
	getItemDetailApiData: mocks.getItemDetailApiDataMock
}));

vi.mock('@/content/download/filename', () => ({
	getFileNameTemplate: mocks.getFileNameTemplateMock
}));

import { resolveDownloadAttempt } from '@/content/download/flow/resolve-download-attempt';

describe('resolveDownloadAttempt', () => {
	beforeEach(() => {
		mocks.getWebApiDataMock.mockReset();
		mocks.getItemDetailApiDataMock.mockReset();
		mocks.getFileNameTemplateMock.mockReset();
	});

	it('prefers the web API URL when available', async () => {
		mocks.getWebApiDataMock.mockResolvedValue({
			video: {
				playAddr: ['https://cdn.example.com/api.mp4']
			}
		});

		const result = await resolveDownloadAttempt({
			videoData: { user: 'creator' },
			attrs: {
				filename: 'video.mp4',
				apiId: '123',
				url: null,
				pageUrl: 'https://www.tiktok.com/@creator/video/123'
			},
			env: { chromium: true },
			nameTemplate: false,
			candidates: {
				domVideoUrl: 'https://cdn.example.com/dom.mp4',
				previewCachedUrl: 'https://cdn.example.com/preview.mp4',
				previewWaitedUrl: null,
				previewWaitAttempted: false
			}
		});

		expect(result.videoUrl).toBe('https://cdn.example.com/api.mp4');
		expect(result.source).toBe('web-api');
		expect(result.needsPreviewWait).toBe(false);
	});

	it('falls back to the item-detail API when the web API throws', async () => {
		mocks.getWebApiDataMock.mockRejectedValue(new Error('blocked'));
		mocks.getItemDetailApiDataMock.mockResolvedValue({
			video: {
				downloadAddr: {
					urlList: ['https://cdn.example.com/item-detail.mp4']
				}
			}
		});

		const result = await resolveDownloadAttempt({
			videoData: {},
			attrs: {
				filename: 'video.mp4',
				apiId: '123',
				url: null,
				pageUrl: null
			},
			env: { chromium: true },
			nameTemplate: false,
			candidates: {
				domVideoUrl: null,
				previewCachedUrl: null,
				previewWaitedUrl: null,
				previewWaitAttempted: false
			}
		});

		expect(result.videoUrl).toBe('https://cdn.example.com/item-detail.mp4');
		expect(result.source).toBe('item-detail-api');
	});

	it('signals preview wait when no URL is resolved yet but an apiId exists', async () => {
		mocks.getWebApiDataMock.mockResolvedValue(null);

		const result = await resolveDownloadAttempt({
			videoData: {},
			attrs: {
				filename: 'video.mp4',
				apiId: '123',
				url: null,
				pageUrl: null
			},
			env: { chromium: true },
			nameTemplate: false,
			candidates: {
				domVideoUrl: null,
				previewCachedUrl: null,
				previewWaitedUrl: null,
				previewWaitAttempted: false
			}
		});

		expect(result.videoUrl).toBeNull();
		expect(result.source).toBeNull();
		expect(result.needsPreviewWait).toBe(true);
	});

	it('uses a cached preview URL before waiting again', async () => {
		mocks.getWebApiDataMock.mockResolvedValue(null);

		const result = await resolveDownloadAttempt({
			videoData: {},
			attrs: {
				filename: 'video.mp4',
				apiId: '123',
				url: null,
				pageUrl: null
			},
			env: { chromium: true },
			nameTemplate: false,
			candidates: {
				domVideoUrl: null,
				previewCachedUrl: 'https://cdn.example.com/preview.mp4',
				previewWaitedUrl: null,
				previewWaitAttempted: false
			}
		});

		expect(result.videoUrl).toBe('https://cdn.example.com/preview.mp4');
		expect(result.source).toBe('preview-cache');
		expect(result.needsPreviewWait).toBe(false);
	});

	it('allows blob URLs on chromium when no better URL exists', async () => {
		mocks.getWebApiDataMock.mockResolvedValue(null);

		const result = await resolveDownloadAttempt({
			videoData: {},
			attrs: {
				filename: 'video.mp4',
				apiId: null,
				url: null,
				pageUrl: null
			},
			env: { chromium: true },
			nameTemplate: false,
			candidates: {
				domVideoUrl: 'blob:https://www.tiktok.com/123',
				previewCachedUrl: null,
				previewWaitedUrl: null,
				previewWaitAttempted: false
			}
		});

		expect(result.videoUrl).toBe('blob:https://www.tiktok.com/123');
		expect(result.source).toBe('dom-blob');
		expect(result.blockedReason).toBeNull();
	});

	it('blocks blob-only downloads on non-chromium runtimes', async () => {
		mocks.getWebApiDataMock.mockResolvedValue(null);

		const result = await resolveDownloadAttempt({
			videoData: {},
			attrs: {
				filename: 'video.mp4',
				apiId: null,
				url: null,
				pageUrl: null
			},
			env: { chromium: false },
			nameTemplate: false,
			candidates: {
				domVideoUrl: 'blob:https://www.tiktok.com/123',
				previewCachedUrl: null,
				previewWaitedUrl: null,
				previewWaitAttempted: false
			}
		});

		expect(result.videoUrl).toBeNull();
		expect(result.source).toBeNull();
		expect(result.blockedReason).toBe('firefox-blob');
	});

	it('uses the naming template result when provided', async () => {
		mocks.getWebApiDataMock.mockResolvedValue({
			video: {
				playAddr: ['https://cdn.example.com/api.mp4']
			}
		});
		mocks.getFileNameTemplateMock.mockReturnValue('templated-name.mp4');

		const result = await resolveDownloadAttempt({
			videoData: { user: 'creator' },
			attrs: {
				filename: 'fallback.mp4',
				apiId: '123',
				url: null,
				pageUrl: null
			},
			env: { chromium: true },
			nameTemplate: '{uploader}',
			candidates: {
				domVideoUrl: null,
				previewCachedUrl: null,
				previewWaitedUrl: null,
				previewWaitAttempted: false
			}
		});

		expect(mocks.getFileNameTemplateMock).toHaveBeenCalled();
		expect(result.filename).toBe('templated-name.mp4');
	});
});
