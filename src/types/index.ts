// Project-wide type barrel.
//
// Keep this barrel type-only. Runtime values should stay in their feature modules
// so content scripts and the MV3 service worker do not gain accidental imports.

export type * from './content';
export type * from './download';
export type * from './options';
export type * from './runtime';
export type * from './ui';
