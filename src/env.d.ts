declare module '*.scss';

declare global {
	const chrome: any;

	var downloadSessions: Map<string, unknown> | undefined;
}

export {};
