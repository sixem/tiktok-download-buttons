// Item metadata contracts shared by observers, mode setup, and download flow.

import type { TTDBEnvironment, TTDBMode } from './state';

export type ItemSetupData = {
	mode: TTDBMode;
	env: TTDBEnvironment;
	container: Element;
};

export type ItemVideoData = {
	id: string | number | null;
	user: string | null;
	url: string | null;
	description?: string | null;
	pageUrl?: string | null;
	videoApiId?: string | null;
	videoId?: string | null;
	[key: string]: unknown;
};
