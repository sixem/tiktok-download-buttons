// TikTok's wide feed keeps its controls outside the individual video articles.
// One control bar follows the currently visible article and can be replaced as
// the feed advances, so it cannot use the ordinary per-article injection path.
import { TTDB } from '@/content/core/state';
import { downloadHook } from '@/content/download/flow/download-hook';
import { itemData } from '@/content/items/data-registry';
import { extractFeedVideoId } from '@/content/modes/feed';
import { createButton } from '@/content/ui/buttons';

const COLUMN_SELECTOR = '[data-e2e="anchoring-player-column"]';
const HOST_SELECTOR = '[data-e2e="anchoring-chrome-host"]';
const RAIL_SELECTOR = 'section[class*="-SectionActionBarContainer"]';
const ARTICLE_SELECTOR = 'article[id^="one-column-item-"], article[data-e2e="recommend-list-item-container"]';
const ACTIVE_VIDEO_ATTRIBUTE = 'data-ttdb-anchored-video-id';

type Binding = {
	article: Element;
	videoId: string;
	rail: Element;
	button: HTMLElement;
};

// Pick the article occupying most of the player, even if its media is not ready.
// Filtering by video availability here could select a preloaded neighboring post.
export const getActiveAnchoredArticle = (column: Element, host: Element) => {
	const player = host.getBoundingClientRect();
	const top = Math.max(0, player.top);
	const bottom = Math.min(window.innerHeight, player.bottom);
	if (player.width <= 0 || bottom <= top) return null;

	let active: Element | null = null;
	let maxOverlap = 0;
	for (const article of column.querySelectorAll(ARTICLE_SELECTOR)) {
		const rect = article.getBoundingClientRect();
		const overlapsHorizontally = rect.right > player.left && rect.left < player.right;
		const overlap = overlapsHorizontally ? Math.max(0, Math.min(rect.bottom, bottom) - Math.max(rect.top, top)) : 0;
		if (overlap > maxOverlap) {
			active = article;
			maxOverlap = overlap;
		}
	}
	return active;
};

export const createAnchoredFeedController = (app: Element) => {
	let column: Element | null = null;
	let binding: Binding | null = null;
	let frame: number | null = null;

	const clearBinding = () => {
		if (!binding) return;
		binding.button.remove();
		binding.rail.classList.remove('ttdb__anchored-feed-rail');
		if (binding.article.getAttribute(ACTIVE_VIDEO_ATTRIBUTE) === binding.videoId) {
			binding.article.removeAttribute(ACTIVE_VIDEO_ATTRIBUTE);
		}
		binding = null;
	};

	const sync = () => {
		frame = null;
		column = app.querySelector(COLUMN_SELECTOR);
		const host = column?.querySelector(HOST_SELECTOR);
		const rail = host?.querySelector(RAIL_SELECTOR);
		const article = column && host ? getActiveAnchoredArticle(column, host) : null;
		const videoId = article ? extractFeedVideoId(article) : null;

		if (!column || !host || !rail || !article || !videoId || !/^\d+$/.test(videoId)) {
			clearBinding();
			return;
		}

		if (binding?.article === article && binding.videoId === videoId && binding.rail === rail && binding.button.parentElement === rail) {
			return;
		}
		clearBinding();

		const videoData = itemData.get(article, { mode: TTDB.MODE.FEED, env: TTDB.ENV.APP, container: article });
		const playerColumn = column;
		videoData.id = videoId;
		videoData.videoApiId = videoId;
		const button = createButton.FEED();
		button.classList.add('ttdb__button_feed--anchored');
		button.setAttribute('aria-label', 'Download video');
		button.setAttribute('role', 'button');
		button.tabIndex = 0;
		button.ttdbItem = article;
		const originalUser = videoData.user;
		const originalPageUrl = videoData.pageUrl;
		const originalDescription = videoData.description;
		const syncAuthor = () => {
			videoData.description = host.querySelector('[data-e2e="video-desc"]')?.textContent?.trim() || originalDescription;
			const profile = host.querySelector('a[data-e2e="video-author-avatar"][href^="/@"]');
			const username = /^\/@([^/?#]+)/.exec(profile?.getAttribute('href') || '')?.[1];
			if (!username) {
				videoData.user = originalUser;
				videoData.pageUrl = originalPageUrl;
				if (originalPageUrl) button.setAttribute('data-video-page-url', originalPageUrl);
				else button.removeAttribute('data-video-page-url');
				return;
			}
			videoData.user = username;
			videoData.pageUrl = `https://www.tiktok.com/@${username}/video/${videoId}`;
			button.setAttribute('data-video-page-url', videoData.pageUrl);
		};
		syncAuthor();

		// A scroll can change the visible item before the next animation frame.
		// Never allow a stale button to download the previously visible video.
		button.addEventListener('click', (event) => {
			if (!playerColumn.isConnected || !host.isConnected || getActiveAnchoredArticle(playerColumn, host) !== article || extractFeedVideoId(article) !== videoId
				|| host.querySelector(RAIL_SELECTOR) !== rail || button.parentElement !== rail) {
				event.preventDefault();
				event.stopImmediatePropagation();
				schedule();
				return;
			}
			// The creator metadata can finish rendering after the player itself.
			syncAuthor();
		}, true);
		button.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			button.click();
		});
		void downloadHook(button, videoData);
		article.setAttribute(ACTIVE_VIDEO_ATTRIBUTE, videoId);
		button.style.opacity = '1';
		rail.classList.add('ttdb__anchored-feed-rail');
		rail.prepend(button);
		binding = { article, videoId, rail, button };
	};

	const schedule = () => {
		if (frame === null) frame = window.requestAnimationFrame(sync);
	};
	const scheduleVisibleChange = () => {
		if (column) schedule();
	};

	const handleMutations = (mutations: MutationRecord[]) => {
		if (column && !column.isConnected) {
			schedule();
			return;
		}
		for (const mutation of mutations) {
			if (column && (column.contains(mutation.target) || mutation.target.contains(column))) {
				schedule();
				return;
			}
			if (!column) {
				const target = mutation.target instanceof Element ? mutation.target : null;
				if (target?.matches(COLUMN_SELECTOR)) {
					schedule();
					return;
				}
				for (const node of mutation.addedNodes) {
					if (node instanceof Element && (node.matches(COLUMN_SELECTOR) || node.querySelector(COLUMN_SELECTOR))) {
						schedule();
						return;
					}
				}
			}
		}
	};

	document.addEventListener('scroll', scheduleVisibleChange, { capture: true, passive: true });
	window.addEventListener('resize', scheduleVisibleChange, { passive: true });
	schedule();

	return {
		handleMutations,
		disconnect: () => {
			document.removeEventListener('scroll', scheduleVisibleChange, true);
			window.removeEventListener('resize', scheduleVisibleChange);
			if (frame !== null) window.cancelAnimationFrame(frame);
			clearBinding();
		}
	};
};
