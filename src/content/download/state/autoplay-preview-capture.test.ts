import { describe, expect, it, vi } from 'vitest';
import { findVideoIdForVideoElement } from '@/content/download/state/autoplay-preview-capture';

const createButton = (videoId: string) => {
	return {
		getAttribute: (name: string) => (name === 'video-id' ? videoId : null)
	} as Element;
};

const createItemRoot = (button: Element | null) => {
	return {
		querySelector: vi.fn(() => button)
	} as Element;
};

const createVideoElement = (itemRoot: Element | null) => {
	const closest = vi.fn(() => itemRoot);

	return {
		video: {
			closest
		} as unknown as HTMLVideoElement,
		closest
	};
};

describe('findVideoIdForVideoElement', () => {
	it('returns the TTDB button id from the same item root', () => {
		const itemRoot = createItemRoot(createButton('12345'));
		const { video, closest } = createVideoElement(itemRoot);

		expect(findVideoIdForVideoElement(video)).toBe('12345');
		expect(closest).toHaveBeenCalledTimes(1);
		expect(itemRoot.querySelector).toHaveBeenCalledTimes(1);
	});

	it('does not borrow a neighboring button when the item has no local TTDB button yet', () => {
		const itemRoot = createItemRoot(null);
		const { video, closest } = createVideoElement(itemRoot);

		expect(findVideoIdForVideoElement(video)).toBeNull();
		expect(closest).toHaveBeenCalledTimes(1);
		expect(itemRoot.querySelector).toHaveBeenCalledTimes(1);
	});

	it('does not scan outside the owning item root', () => {
		const { video, closest } = createVideoElement(null);

		expect(findVideoIdForVideoElement(video)).toBeNull();
		expect(closest).toHaveBeenCalledTimes(1);
	});
});
