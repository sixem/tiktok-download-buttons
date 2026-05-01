// Shared content-script state contracts.
//
// Runtime state still lives in `content/core/state.ts`; this file only names the
// shape so feature modules can depend on explicit contracts instead of globals.

export type TTDBMode = '0' | '1' | '2' | '4';
export type TTDBEnvironment = symbol;

export type TTDBTimerRegistry = {
	appCreationWatcher?: number | null;
	browserObserver?: number | null;
	scrollBreak?: number | null;
	updateLoop?: number | null;
	[key: string]: number | null | undefined;
};

export type TTDBObserverRegistry = {
	main?: MutationObserver | null;
	browserObserver?: MutationObserver | null;
	[key: string]: MutationObserver | null | undefined;
};

export type TTDBLoggerNamespace = {
	info: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
	debug: (...args: unknown[]) => void;
	log: (...args: unknown[]) => void;
};

export type TTDBLogger = Partial<TTDBLoggerNamespace> & {
	write?: (level: string, namespace: string | null | undefined, ...args: unknown[]) => void;
	ns?: (namespace: string) => TTDBLoggerNamespace;
	styles?: Record<string, string>;
};

export type TTDBState = {
	__ttdbBootstrapped?: boolean;
	__ttdbSetIntervalWrapped?: boolean;
	autoplayPreviewCaptureInstalled?: boolean;
	assetPicker?: {
		open?: (options: unknown) => void;
	};
	debug?: {
		previewCache?: boolean;
	};
	DEFAULT_ENV: TTDBEnvironment;
	ENV: {
		APP: TTDBEnvironment;
		__NEXT: TTDBEnvironment;
	};
	headers: RequestInit;
	interval: {
		counter: number;
		delay: number;
	};
	LOG?: TTDBLogger;
	MODE: {
		FEED: TTDBMode;
		GRID: TTDBMode;
		BROWSER: TTDBMode;
		BASIC_PLAYER: TTDBMode;
	};
	observers: TTDBObserverRegistry;
	setInterval: (count: number) => void;
	stats: {
		downloadAttemptOrder?: string[];
		downloadAttemptsByVideo: Record<string, number>;
	};
	timers: TTDBTimerRegistry;
};

export type ExpressionRegistry = {
	vanillaVideoUrl: (
		haystack: string | null | undefined,
		options?: { strict?: boolean }
	) => RegExpExecArray | null;
};

export type UtilityRegistry = {
	dispatchEvent: (
		element: Element,
		eventType: new (type: string, eventInitDict?: UIEventInit) => Event,
		event: string
	) => void;
	ranGen: (charSet: string, length?: number) => string;
	ranInt: (min: number, max: number) => number;
	sanitizeFilename: (value: string) => string;
	traverseObj: <T = unknown>(obj: unknown, needles: string[], index?: number) => T | undefined;
	truncateString: (value: string, length: number) => string;
	validateVideoRequest: (response: Response) => boolean;
};
