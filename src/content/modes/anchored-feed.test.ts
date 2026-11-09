// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	download: vi.fn(),
	hook: vi.fn((button: HTMLElement, data: { videoApiId: string }) => {
		button.setAttribute('video-id', data.videoApiId);
		button.addEventListener('click', () => mocks.download(data.videoApiId));
	})
}));

vi.mock('@/content/download/flow/download-hook', () => ({ downloadHook: mocks.hook }));
vi.mock('@/content/items/data-registry', () => ({
	itemData: { get: () => ({ id: null, user: null, url: null }) }
}));

import { TTDB } from '@/content/core/state';
import { createAnchoredFeedController } from '@/content/modes/anchored-feed';
import { createFeedMode } from '@/content/modes/feed';
import { findVideoIdForVideoElement } from '@/content/download/state/autoplay-preview-capture';

const setRect = (element: Element, top: number, height = 600) => {
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
		x: 0, y: top, top, bottom: top + height, left: 0, right: 800,
		width: 800, height, toJSON: () => ({})
	} as DOMRect);
};

const required = <T extends Element>(root: ParentNode, selector: string): T => {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`Missing test element: ${selector}`);
	return element;
};

describe('wide feed buttons', () => {
	let frames: FrameRequestCallback[];
	let app: HTMLElement;
	let first: HTMLElement;
	let second: HTMLElement;
	let host: HTMLElement;
	let observer: MutationObserver;
	let controller: ReturnType<typeof createAnchoredFeedController>;

	const flushFrame = () => {
		const callbacks = frames.splice(0);
		for (const callback of callbacks) callback(0);
	};

	const deliverMutations = () => controller.handleMutations(observer.takeRecords());

	beforeEach(() => {
		mocks.download.mockClear();
		mocks.hook.mockClear();
		frames = [];
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
			frames.push(callback);
			return frames.length;
		});
		vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
		document.body.innerHTML = `
			<div id="app"><main data-e2e="anchoring-player-column">
				<div><article id="one-column-item-0" data-e2e="recommend-list-item-container">
					<div mode="0"><div id="xgwrapper-0-111" class="xgplayer-container"><video></video></div></div>
				</article><article id="one-column-item-1" data-e2e="recommend-list-item-container">
					<div mode="0"><div id="xgwrapper-0-222" class="xgplayer-container"><video></video></div></div>
				</article></div>
				<div data-e2e="anchoring-chrome-host"><a data-e2e="video-author-avatar" href="/@first"></a><span data-e2e="video-desc">First caption</span><section class="css-SectionActionBarContainer"><div data-e2e="like-icon"></div></section></div>
			</main></div>`;
		app = required(document, '#app');
		first = required(document, '#one-column-item-0');
		second = required(document, '#one-column-item-1');
		host = required(document, '[data-e2e="anchoring-chrome-host"]');
		setRect(host, 0);
		setRect(first, 0);
		setRect(second, 600);
		observer = new MutationObserver(() => {});
		observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'id', 'mode', 'data-e2e'] });
		controller = createAnchoredFeedController(app);
		flushFrame();
	});

	afterEach(() => {
		controller.disconnect();
		observer.disconnect();
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	it('binds the shared rail to the visible video and exposes its id for preview capture', () => {
		const button = required<HTMLAnchorElement>(host, '.ttdb__button_feed--anchored');
		expect(button.getAttribute('video-id')).toBe('111');
		expect(button.getAttribute('title')).toBeNull();
		expect(button.textContent).toBe('');
		expect(button.getAttribute('data-video-page-url')).toBe('https://www.tiktok.com/@first/video/111');
		expect(button.ttdbItem).toBe(first);
		expect(findVideoIdForVideoElement(required(first, 'video'))).toBe('111');
		expect(findVideoIdForVideoElement(required(second, 'video'))).toBeNull();
		button.click();
		expect(mocks.download).toHaveBeenCalledExactlyOnceWith('111');
	});

	it('allows keyboard activation of the wide-feed button', () => {
		const button = required<HTMLAnchorElement>(host, '.ttdb__button_feed--anchored');
		expect(button.tabIndex).toBe(0);
		expect(button.getAttribute('role')).toBe('button');
		button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		expect(mocks.download).toHaveBeenCalledTimes(2);
	});

	it('blocks a stale click, switches videos on scroll, and reinserts after the rail is replaced', () => {
		const stale = required<HTMLAnchorElement>(host, '.ttdb__button_feed--anchored');
		vi.mocked(first.getBoundingClientRect).mockReturnValue({ ...first.getBoundingClientRect(), top: -600, bottom: 0 } as DOMRect);
		vi.mocked(second.getBoundingClientRect).mockReturnValue({ ...second.getBoundingClientRect(), top: 0, bottom: 600 } as DOMRect);
		required(host, '[data-e2e="video-author-avatar"]').setAttribute('href', '/@second');
		document.dispatchEvent(new Event('scroll'));
		stale.click();
		expect(mocks.download).not.toHaveBeenCalled();
		flushFrame();
		let button = required<HTMLAnchorElement>(host, '.ttdb__button_feed--anchored');
		expect(button.getAttribute('video-id')).toBe('222');
		expect(button.getAttribute('data-video-page-url')).toBe('https://www.tiktok.com/@second/video/222');
		expect(button.ttdbItem).toBe(second);
		expect(first.hasAttribute('data-ttdb-anchored-video-id')).toBe(false);
		button.click();
		expect(mocks.download).toHaveBeenCalledExactlyOnceWith('222');

		const oldRail = required(host, 'section');
		const newRail = oldRail.cloneNode(false) as HTMLElement;
		oldRail.replaceWith(newRail);
		deliverMutations();
		flushFrame();
		button = required<HTMLAnchorElement>(newRail, '.ttdb__button_feed--anchored');
		expect(button.getAttribute('video-id')).toBe('222');
		expect(host.querySelectorAll('.ttdb__button_feed--anchored')).toHaveLength(1);
	});

	it('uses the current creator if the profile loads after the player', () => {
		const button = required<HTMLAnchorElement>(host, '.ttdb__button_feed--anchored');
		required(host, '[data-e2e="video-author-avatar"]').setAttribute('href', '/@updated');
		required(host, '[data-e2e="video-desc"]').textContent = 'Updated caption';
		button.click();
		expect(button.getAttribute('data-video-page-url')).toBe('https://www.tiktok.com/@updated/video/111');
		expect(mocks.hook.mock.calls[0][1]).toMatchObject({ user: 'updated', videoApiId: '111', description: 'Updated caption' });
	});

	it('does not borrow a preloaded video when the visible article has no id', () => {
		required(first, '[id^="xgwrapper-"]').removeAttribute('id');
		deliverMutations();
		flushFrame();
		expect(host.querySelector('.ttdb__button_feed--anchored')).toBeNull();
		expect(first.hasAttribute('data-ttdb-anchored-video-id')).toBe(false);
	});

	it('restores the button when it is moved out of the shared rail', () => {
		const button = required<HTMLAnchorElement>(host, '.ttdb__button_feed--anchored');
		host.append(button);
		button.click();
		expect(mocks.download).not.toHaveBeenCalled();
		deliverMutations();
		flushFrame();
		const rail = required(host, 'section');
		expect(required(rail, '.ttdb__button_feed--anchored').getAttribute('video-id')).toBe('111');
		expect(host.querySelectorAll('.ttdb__button_feed--anchored')).toHaveLength(1);
	});

	it('handles a delayed action rail and recycled article with a new video', () => {
		required(host, 'section').remove();
		deliverMutations();
		flushFrame();
		expect(host.querySelector('.ttdb__button_feed--anchored')).toBeNull();

		const rail = document.createElement('section');
		rail.className = 'css-SectionActionBarContainer';
		host.append(rail);
		required(first, '[id^="xgwrapper-"]').id = 'xgwrapper-0-444';
		deliverMutations();
		flushFrame();
		const button = required<HTMLAnchorElement>(rail, '.ttdb__button_feed--anchored');
		expect(button.getAttribute('video-id')).toBe('444');
		button.click();
		expect(mocks.download).toHaveBeenCalledExactlyOnceWith('444');
	});

	it('resumes injection if the wide layout is removed and later added again', () => {
		const column = required(app, '[data-e2e="anchoring-player-column"]');
		column.remove();
		deliverMutations();
		flushFrame();
		expect(first.hasAttribute('data-ttdb-anchored-video-id')).toBe(false);
		app.append(column);
		deliverMutations();
		flushFrame();
		expect(required(host, '.ttdb__button_feed--anchored').getAttribute('video-id')).toBe('111');
	});

	it('keeps the ordinary per-article feed button working without a wide player', () => {
		app.innerHTML = `<article id="regular"><div mode="0"><div id="xgwrapper-0-333" class="xgplayer-container"><video></video></div><section class="css-SectionActionBarContainer"></section></div></article>`;
		deliverMutations();
		flushFrame();
		const article = required(document, '#regular');
		expect(createFeedMode()(article, { mode: TTDB.MODE.FEED, env: TTDB.ENV.APP, container: article })).toBe(true);
		const button = required<HTMLAnchorElement>(article, '.ttdb__button_feed');
		expect(button.getAttribute('video-id')).toBe('333');
		button.click();
		expect(mocks.download).toHaveBeenCalledExactlyOnceWith('333');
	});
});
