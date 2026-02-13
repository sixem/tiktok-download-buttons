declare module '*.scss';

declare global {
	const chrome: any;

	var downloadSessions: Map<string, unknown> | undefined;

	// Custom element fields used by TTDB content-script wiring.
	// These properties are attached at runtime to keep per-node UI/download state.
	interface HTMLElement {
		ttdbItem?: Element | null;
		ttIsProcessed?: boolean;
		ttIsInitialized?: boolean;
		ttHasSlideshowPickerLauncher?: boolean;
		ttdbPreviewReady?: boolean;
		ttdbInteractivityManaged?: boolean;
		ttdbPreviewCaptureArmed?: boolean;
		hasListener?: boolean;
		ttdbPreviewReadyPromise?: Promise<unknown> | null;
	}

	interface Element {
		ttdbAwaitVideoDataTimerId?: number | null;
	}
}

export {};
