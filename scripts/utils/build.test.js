import { describe, expect, it, vi } from 'vitest';
import {
	createBuildStamp,
	createBuildToken,
	withBuildVersionName
} from './build.js';

describe('build utils', () => {
	it('creates a stable timestamp stamp for a given date', () => {
		const date = new Date(2026, 0, 2, 3, 4, 5);
		expect(createBuildStamp(date)).toBe('20260102-030405');
	});

	it('creates a token with a minimum length of four characters', () => {
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

		try {
			expect(createBuildToken({
				length: 2,
				date: new Date('2026-01-02T03:04:05Z')
			})).toHaveLength(4);
		} finally {
			randomSpy.mockRestore();
		}
	});

	it('adds the build token to the version name', () => {
		expect(withBuildVersionName({
			version: '1.2.3'
		}, 'abc12')).toEqual({
			version: '1.2.3',
			version_name: '1.2.3 (abc12)'
		});
	});

	it('prefers an existing version_name when present', () => {
		expect(withBuildVersionName({
			version: '1.2.3',
			version_name: 'Beta'
		}, 'abc12')).toEqual({
			version: '1.2.3',
			version_name: 'Beta (abc12)'
		});
	});
});
