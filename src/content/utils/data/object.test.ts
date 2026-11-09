import { beforeEach, describe, expect, it } from 'vitest';
import { UTIL } from '@/content/core/state';
import { setupObjectUtils } from '@/content/utils/data/object';

describe('setupObjectUtils', () => {
	beforeEach(() => {
		setupObjectUtils();
	});

	it('registers traverseObj for recursive key-path lookup', () => {
		const value = {
			wrapper: {
				deep: {
					'target-group': {
						title: 'found'
					}
				}
			}
		};

		expect(UTIL.traverseObj(value, ['target-group', 'title'])).toBe('found');
		expect(UTIL.traverseObj(value, ['missing', 'title'])).toBeUndefined();
	});
});
