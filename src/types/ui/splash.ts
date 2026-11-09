// Toast/splash UI contracts shared by state and presenters.

export type SplashMessage = string | {
	title?: string;
	detail?: string | null;
	meta?: string | null;
	spinner?: boolean;
};

export type SplashOptions = {
	id?: string | number;
	detail?: string | null;
	meta?: string | null;
	// Small label shown at the far right of the toast title row.
	// Used for short source indicators like "API", "DOM", "INTERCEPT", "BLOB".
	tag?: string | null;
	spinner?: boolean;
	state?: number;
	hideMeta?: boolean;
	sticky?: boolean;
	duration?: number;
};

export type SplashState = {
	create: () => HTMLElement | null;
	dismiss: (toastId?: string | number) => void;
	message: (
		message: SplashMessage,
		options?: SplashOptions,
		callback?: (() => void) | null
	) => boolean;
	timers?: Map<string, number>;
	toastCounter?: number;
	toasts?: Map<string, HTMLElement>;
	wrapper?: HTMLElement | null;
};
