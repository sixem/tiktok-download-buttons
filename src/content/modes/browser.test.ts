// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ click: vi.fn() }));
vi.mock('@/content/download/flow/download-hook', () => ({
	downloadHook: (button: HTMLElement, data: { videoApiId: string }) => {
		button.setAttribute('video-id', data.videoApiId);
		if (!button.hasListener) {
			button.addEventListener('click', mocks.click);
			button.hasListener = true;
		}
	}
}));
vi.mock('@/content/items/data-registry', () => ({
	itemData: { get: (item: Element) => ({ id: '123', user: null, url: null, videoApiId: item.querySelector('[id^="xgwrapper-"]')?.id.split('-').pop() || '123' }) }
}));

import { TTDB } from '@/content/core/state';
import { createBrowserMode } from '@/content/modes/browser';

afterEach(() => {
	TTDB.observers.browserObserver?.disconnect();
	clearTimeout(TTDB.timers.browserObserver);
	window.history.replaceState({}, '', '/');
	mocks.click.mockReset();
	document.body.replaceChildren();
});

describe('video viewer action button', () => {
	it('injects when a delayed controls panel appears beside the viewer', async () => {
		document.body.innerHTML = `
			<div id="viewer">
				<div class="css-DivBrowserModeContainer"><div id="player"><video src="blob:video"></video></div></div>
			</div>`;
		const player = document.querySelector('#player') as HTMLElement;
		const viewer = document.querySelector('#viewer') as HTMLElement;
		createBrowserMode()(player, { env: TTDB.ENV.APP, mode: TTDB.MODE.BROWSER, container: player });
		expect(document.querySelector('.ttdb__button_browser')).toBeNull();

		viewer.insertAdjacentHTML('beforeend', '<aside><div data-e2e="browse-copy"></div></aside>');
		await vi.waitFor(() => {
			const slot = viewer.querySelector('[data-e2e="browse-copy"]');
			expect(slot?.previousElementSibling?.classList.contains('ttdb__button_browser')).toBe(true);
		});
		expect(document.querySelectorAll('.ttdb__button_browser')).toHaveLength(1);
	});

	it('restores the download button when the information panel is replaced', async () => {
		document.body.innerHTML = `
			<div role="dialog">
				<div id="player"><video src="blob:video"></video></div>
				<aside id="panel"><div class="css-DivCopyLinkContainer"></div></aside>
			</div>`;
		const player = document.querySelector('#player') as HTMLElement;
		const panel = document.querySelector('#panel') as HTMLElement;
		createBrowserMode()(player, { env: TTDB.ENV.APP, mode: TTDB.MODE.BROWSER, container: player });
		const button = document.querySelector('.ttdb__button_browser');
		expect(button?.nextElementSibling?.className).toBe('css-DivCopyLinkContainer');

		// Navigating to a post with different comment controls can replace the
		// entire panel rather than just the current copy-link element.
		panel.outerHTML = '<aside id="new-panel"><div data-e2e="browse-copy"></div></aside>';
		await vi.waitFor(() => {
			const replacement = document.querySelector('#new-panel [data-e2e="browse-copy"]');
			expect(replacement?.previousElementSibling).toBe(button);
		});
	});

	it('moves a still-connected button to a replacement slot', async () => {
		document.body.innerHTML = `
			<div role="dialog">
				<div id="player"><video src="blob:video"></video></div>
				<aside><div class="css-DivCopyLinkContainer"></div></aside>
			</div>`;
		const player = document.querySelector('#player') as HTMLElement;
		createBrowserMode()(player, { env: TTDB.ENV.APP, mode: TTDB.MODE.BROWSER, container: player });
		const button = document.querySelector('.ttdb__button_browser') as HTMLElement;
		const oldSlot = document.querySelector('.css-DivCopyLinkContainer') as HTMLElement;
		oldSlot.className = 'old-slot';
		oldSlot.insertAdjacentHTML('afterend', '<div data-e2e="browse-copy"></div>');

		await vi.waitFor(() => {
			const replacement = document.querySelector('[data-e2e="browse-copy"]');
			expect(replacement?.previousElementSibling).toBe(button);
		});
		expect(document.querySelectorAll('.ttdb__button_browser')).toHaveLength(1);
	});

	it('blocks stale clicks while the viewer changes videos', async () => {
		window.history.replaceState({}, '', '/@creator/video/111');
		document.body.innerHTML = `
			<div role="dialog">
				<div id="player"><div id="xgwrapper-0-111"><video src="blob:first"></video></div></div>
				<aside><div data-e2e="browse-copy"></div></aside>
			</div>`;
		const player = document.querySelector('#player') as HTMLElement;
		createBrowserMode()(player, { env: TTDB.ENV.APP, mode: TTDB.MODE.BROWSER, container: player });
		const button = document.querySelector('.ttdb__button_browser') as HTMLElement;
		expect(button.getAttribute('video-id')).toBe('111');

		window.history.replaceState({}, '', '/@creator/video/222');
		player.innerHTML = '<div id="xgwrapper-0-222"><video src="blob:second"></video></div>';
		button.click();
		expect(mocks.click).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(button.getAttribute('video-id')).toBe('222'));
		button.click();
		expect(mocks.click).toHaveBeenCalledOnce();
	});
});
