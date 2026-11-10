// @vitest-environment happy-dom
/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import popupHtml from './popup.html?raw';

const mocks = vi.hoisted(() => ({
	storageGet: vi.fn(),
	storageSet: vi.fn()
}));
vi.mock('@/popup-utils', () => mocks);

describe('filename preview', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('updates for stored, edited, empty, and reset templates', async () => {
		document.body.innerHTML = new DOMParser().parseFromString(popupHtml, 'text/html').body.innerHTML;
		vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '1.2.4' }) } });
		mocks.storageGet.mockResolvedValue({
			'download-subfolder-path': '',
			'download-naming-template': '{uploader} - {desc}'
		});
		mocks.storageSet.mockResolvedValue(undefined);
		await import('@/popup');
		window.dispatchEvent(new Event('DOMContentLoaded'));

		const input = document.querySelector<HTMLInputElement>('#download-naming-template');
		const preview = document.querySelector<HTMLOutputElement>('#naming-preview');
		const reset = document.querySelector<HTMLButtonElement>('[data-reset-confirm]');
		if (!input || !preview || !reset) throw new Error('Missing popup controls');
		await vi.waitFor(() => expect(preview.textContent).toBe('creator - A video caption.mp4'));

		input.value = '{desc} - {uploader}.MP4';
		input.dispatchEvent(new Event('input'));
		expect(preview.textContent).toBe('A video caption - creator.MP4');

		input.value = '';
		input.dispatchEvent(new Event('input'));
		expect(preview.textContent).toBe('creator - 7234567890123456789.mp4');

		input.value = '{desc}';
		input.dispatchEvent(new Event('input'));
		reset.click();
		await vi.waitFor(() => expect(preview.textContent).toBe('creator - 7234567890123456789.mp4'));
		expect(input.value).toBe('{uploader} - {id}');
	}, 15000);
});
