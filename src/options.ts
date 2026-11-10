// Shared option schema for the extension.
//
// Why this exists:
// - The popup UI needs the same defaults for "Reset" and first-run initialization.
// - Content scripts read settings defensively and tolerate missing values.

import { DEFAULT_NAMING_TEMPLATE } from '@/content/download/filename?popup';

export type TTDBOptionType = 'text' | 'toggle';

export const TTDB_OPTIONS = {
	// Empty string means: download to the default Downloads directory.
	'download-subfolder-path': {
		type: 'text',
		default: ''
	},
	// Default naming aims to be useful even without API data.
	'download-naming-template': {
		type: 'text',
		default: DEFAULT_NAMING_TEMPLATE
	}
} as const satisfies Record<string, { type: TTDBOptionType; default: unknown }>;

export type TTDBOptionKey = keyof typeof TTDB_OPTIONS;
export type TTDBOptionSchema = (typeof TTDB_OPTIONS)[TTDBOptionKey];
