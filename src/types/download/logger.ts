// Minimal logger contract used by download orchestration modules.

export type DownloadLogger = {
	info: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
	debug?: (...args: unknown[]) => void;
	log?: (...args: unknown[]) => void;
};
