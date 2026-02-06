// Shared option schema for the extension.
//
// Why this exists:
// - The service worker needs defaults + migration rules.
// - The popup UI needs the same defaults for "Reset" and first-run initialization.
// Keeping the schema in one place avoids subtle drift over time.

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
		default: '{uploader} - {id}'
	}
} as const satisfies Record<string, { type: TTDBOptionType; default: unknown }>;

export type TTDBOptionKey = keyof typeof TTDB_OPTIONS;
export type TTDBOptionSchema = (typeof TTDB_OPTIONS)[TTDBOptionKey];

