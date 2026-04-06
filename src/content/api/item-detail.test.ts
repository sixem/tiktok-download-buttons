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
});
