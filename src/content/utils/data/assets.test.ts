import { describe, expect, it } from 'vitest';
import { normalizeAssetList } from '@/content/utils/data/assets';

describe('normalizeAssetList', () => {
	it('trims URLs, removes duplicates, and preserves extra fields', () => {
		const assets = normalizeAssetList([
			{ id: '1', url: ' https://cdn.example.com/a.jpg ' },
			{ id: '2', url: 'https://cdn.example.com/a.jpg' },
			{ id: '3', url: 'https://cdn.example.com/b.jpg', label: 'second' },
			{ id: '4', url: '' },
			{ id: '5', url: null }
		]);

		expect(assets).toEqual([
			{ id: '1', url: 'https://cdn.example.com/a.jpg' },
			{ id: '3', url: 'https://cdn.example.com/b.jpg', label: 'second' }
		]);
	});

	it('can exclude data URLs when the caller disables them', () => {
		const assets = normalizeAssetList(
			[
				{ url: 'data:image/png;base64,abc123' },
				{ url: 'https://cdn.example.com/real.jpg' }
			],
			{ allowDataUrls: false }
		);

		expect(assets).toEqual([
			{ url: 'https://cdn.example.com/real.jpg' }
		]);
	});
});
