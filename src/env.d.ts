declare const chrome: any;

declare module '*.scss';

declare global {
	var downloadSessions: Map<string, unknown> | undefined;
}

export {};
