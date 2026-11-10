// A separate Vite module ID keeps the popup and content script self-contained.
declare module '@/content/download/filename?popup' {
	export const DEFAULT_NAMING_TEMPLATE: typeof import('../content/download/filename').DEFAULT_NAMING_TEMPLATE;
	export const getFileNameTemplate: typeof import('../content/download/filename').getFileNameTemplate;
	export const sanitizeFilename: typeof import('../content/download/filename').sanitizeFilename;
}
