import { describe, expect, it } from 'vitest';
import { findVideoIdForVideoElement } from '@/content/download/state/autoplay-preview-capture';

const createButton = (videoId: string) => {
	return {
		getAttribute: (name: string) => (name === 'video-id' ? videoId : null)
	} as Element;
};

const createItemRoot = (button: Element | null) => {
	return {
		querySelector: () => button
	} as Element;
};

const createVideoElement = (itemRoot: Element | null) => {
	return {
		closest: () => itemRoot
	} as HTMLVideoElement;
};

describe('findVideoIdForVideoElement', () => {
	it('returns the TTDB button id from the same item root', () => {
		const video = createVideoElement(createItemRoot(createButton('12345')));

		expect(findVideoIdForVideoElement(video)).toBe('12345');
	});

	it('does not borrow a neighboring button when the item has no local TTDB button yet', () => {
		const video = createVideoElement(createItemRoot(null));

		expect(findVideoIdForVideoElement(video)).toBeNull();
	});

	it('does not scan outside the owning item root', () => {
		const video = createVideoElement(null);

		expect(findVideoIdForVideoElement(video)).toBeNull();
	});
});
