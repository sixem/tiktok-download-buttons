// Runtime fields attached to TikTok DOM nodes by TTDB content scripts.
//
// These are intentionally declared as DOM augmentations because the values live
// on real page elements, not in a separate framework state container.

declare global {
	interface HTMLElement {
		ttdbItem?: Element | null;
		ttIsProcessed?: boolean;
		ttIsInitialized?: boolean;
		ttHasSlideshowPickerLauncher?: boolean;
		ttdbPreviewReady?: boolean;
		ttdbInteractivityManaged?: boolean;
		hasListener?: boolean;
		ttdbPreviewReadyPromise?: Promise<unknown> | null;
	}

	interface Element {
		ttdbAwaitVideoDataTimerId?: number | null;
		ttdbPreviewCaptureArmed?: boolean;
	}
}

export {};
