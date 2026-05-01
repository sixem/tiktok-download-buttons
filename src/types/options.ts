// Option-schema type re-exports.
//
// The schema value stays in `options.ts`; this file lets callers import option
// contracts from the central type barrel without pulling runtime values.

export type {
	TTDBOptionKey,
	TTDBOptionSchema,
	TTDBOptionType
} from '@/options';
