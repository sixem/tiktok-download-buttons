import { describe, expect, it, vi } from 'vitest';
import { ensurePreviewButtonInteractiveWhenReady } from '@/content/download/flow/preview-button-interactivity';

const createButtonState = () => ({} as HTMLElement);

describe('ensurePreviewButtonInteractiveWhenReady', () => {
	it('does nothing for cards that do not need preview-gated interactivity', () => {
		const button = createButtonState();
		const setInteractive = vi.fn();
		const waitForPreview = vi.fn();

		ensurePreviewButtonInteractiveWhenReady({
			button,
			videoApiId: '123',
			isNoModeCard: false,
			setInteractive,
			waitForPreview
		});

		expect(button.ttdbPreviewReady).toBeUndefined();
		expect(button.ttdbPreviewReadyPromise).toBeUndefined();
		expect(setInteractive).not.toHaveBeenCalled();
		expect(waitForPreview).not.toHaveBeenCalled();
	});

	it('marks the button ready immediately when a cached preview URL exists', () => {
		const button = createButtonState();
		const setInteractive = vi.fn();
		const waitForPreview = vi.fn();

		ensurePreviewButtonInteractiveWhenReady({
			button,
			videoApiId: '123',
			isNoModeCard: true,
			getCachedPreview: () => 'https://cdn.example.com/preview.mp4',
			setInteractive,
			waitForPreview
		});

		expect(button.ttdbPreviewReady).toBe(true);
		expect(button.ttdbPreviewReadyPromise).toBeUndefined();
		expect(setInteractive).toHaveBeenCalledWith(true);
		expect(waitForPreview).not.toHaveBeenCalled();
	});

	it('waits once for a preview URL and clears the pending promise afterwards', async () => {
		const button = createButtonState();
		const setInteractive = vi.fn();

		ensurePreviewButtonInteractiveWhenReady({
			button,
			videoApiId: '123',
			isNoModeCard: true,
			previewWaitMs: 25,
			getCachedPreview: () => null,
			waitForPreview: async (videoId, timeoutMs) => {
				expect(videoId).toBe('123');
				expect(timeoutMs).toBe(25);
				return 'https://cdn.example.com/preview.mp4';
			},
			setInteractive
		});

		const pending = button.ttdbPreviewReadyPromise;
		expect(pending).toBeInstanceOf(Promise);

		ensurePreviewButtonInteractiveWhenReady({
			button,
			videoApiId: '123',
			isNoModeCard: true,
			getCachedPreview: () => null,
			waitForPreview: vi.fn(),
			setInteractive
		});

		expect(button.ttdbPreviewReadyPromise).toBe(pending);

		await pending;

		expect(button.ttdbPreviewReady).toBe(true);
		expect(button.ttdbPreviewReadyPromise).toBeNull();
		expect(setInteractive).toHaveBeenCalledTimes(1);
		expect(setInteractive).toHaveBeenCalledWith(true);
	});
});
