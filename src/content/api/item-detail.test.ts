import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getItemDetailApiData } from '@/content/api/item-detail';

describe('getItemDetailApiData', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('strips TikTok response prefixes before parsing JSON', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			headers: {
				get: () => 'application/json'
			},
			text: async () => `for (;;);{"itemInfo":{"itemStruct":{"id":"123"}}}`
		}));

		await expect(getItemDetailApiData('123')).resolves.toEqual({ id: '123' });
	});

	it('throws a parse error when the body is not valid JSON', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			headers: {
				get: () => 'text/html'
			},
			text: async () => 'not-json'
		}));

		await expect(getItemDetailApiData('123')).rejects.toThrow('Item detail API JSON parse failed (text/html)');
	});

	it('throws when itemStruct is missing after a valid response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			headers: {
				get: () => 'application/json'
			},
			text: async () => '{"itemInfo":{}}'
		}));

		await expect(getItemDetailApiData('123')).rejects.toThrow('Item detail API returned no itemStruct');
	});

	it('preserves a pre-2020 video ID exactly when requesting and validating its response', async () => {
		const oldVideoId = '6679641922576846086';
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			headers: { get: () => 'application/json' },
			text: async () => JSON.stringify({ itemInfo: { itemStruct: { id: oldVideoId } } })
		});
		vi.stubGlobal('fetch', fetchMock);

		await expect(getItemDetailApiData(oldVideoId)).resolves.toEqual({ id: oldVideoId });
		expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`itemId=${oldVideoId}`), expect.anything());
	});

	it('rejects an item-detail response for a different video', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			headers: { get: () => 'application/json' },
			text: async () => JSON.stringify({ itemInfo: { itemStruct: { id: '6679641922576846087' } } })
		}));

		await expect(getItemDetailApiData('6679641922576846086')).rejects.toThrow('Item detail API returned a different video');
	});

	it('accepts an item structure without an ID, preserving compatibility with partial responses', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			headers: { get: () => 'application/json' },
			text: async () => JSON.stringify({ itemInfo: { itemStruct: { video: { playAddr: 'https://cdn.example.com/video.mp4' } } } })
		}));

		await expect(getItemDetailApiData('123')).resolves.toEqual({ video: { playAddr: 'https://cdn.example.com/video.mp4' } });
	});
});
