// Download toast presentation helpers.
//
// Keeps toast wording and state transitions centralized so download executors
// can focus on control flow.

import { SPLASH } from '@/content/core/state';
import type { DownloadTag } from '@/types';

type ToastTag = DownloadTag | string | null;

type TerminalToastArgs = {
	isComplete: boolean;
	error?: unknown;
	tag?: ToastTag;
};

type InPageFetchResultArgs = {
	started: boolean;
	tag: ToastTag;
};

const getOptionTag = (options: any, fallbackTag: ToastTag, isProgressToast: boolean) => {
	if (isProgressToast) return null;
	if (Object.hasOwn(options, 'tag')) {
		return options.tag;
	}
	return fallbackTag || null;
};

const renderToast = ({
	toastId,
	fallbackTag,
	message,
	options = {}
}: {
	toastId: string;
	fallbackTag: ToastTag;
	message: any;
	options?: any;
}) => {
	const isProgressToast = !!options.sticky || !!options.spinner;
	const tag = getOptionTag(options, fallbackTag, isProgressToast);

	return SPLASH.message(message, {
		id: toastId,
		tag,
		...options
	});
};

const getDisplayName = (value: string) => {
	if (!value) return 'video';
	const trimmed = String(value).trim();
	if (trimmed.length <= 42) return trimmed;
	return `${trimmed.slice(0, 28)}...${trimmed.slice(-10)}`;
};

export type DownloadToastPresenter = ReturnType<typeof createDownloadToastPresenter>;

export const createDownloadToastPresenter = ({
	toastId,
	filename,
	sourceTag
}: {
	toastId: string;
	filename: string;
	sourceTag: ToastTag;
}) => {
	const displayName = getDisplayName(filename);

	return {
		toastId,
		filename,
		sourceTag,
		getDisplayName,
		showDownloading: () => {
			return renderToast({
				toastId,
				fallbackTag: sourceTag,
				message: {
					title: 'Downloading',
					detail: displayName
				},
				options: {
					state: 0,
					sticky: true,
					spinner: true
				}
			});
		},
		showDownloadStartedInBrowser: () => {
			return SPLASH.message({
				title: 'Download started',
				detail: displayName,
				meta: 'Finishing in browser...'
			}, {
				id: toastId,
				state: 0,
				sticky: false,
				spinner: false,
				duration: 7000,
				hideMeta: false,
				tag: null
			});
		},
		showBlockedNoTabFallback: () => {
			return renderToast({
				toastId,
				fallbackTag: sourceTag,
				message: {
					title: 'Download blocked',
					detail: 'TikTok blocked this download attempt. Try again in a moment.'
				},
				options: {
					duration: 6500,
					state: 3,
					hideMeta: true,
					sticky: false,
					spinner: false
				}
			});
		},
		showRetryingInPageFetch: () => {
			return SPLASH.message({
				title: 'Retrying download',
				detail: displayName,
				meta: 'Fetching video data...'
			}, {
				id: toastId,
				state: 0,
				sticky: true,
				spinner: true,
				hideMeta: false,
				tag: null
			});
		},
		showInPageFetchResult: ({
			started,
			tag
		}: InPageFetchResultArgs) => {
			return renderToast({
				toastId,
				fallbackTag: sourceTag,
				message: {
					title: started ? 'Download triggered' : 'Download failed',
					detail: displayName,
					meta: started ? 'Saved to Downloads (no subfolder).' : 'Retry failed. Try again in a moment.'
				},
				options: {
					duration: started ? 4800 : 6500,
					state: started ? 1 : 3,
					hideMeta: !started,
					sticky: false,
					spinner: false,
					tag
				}
			});
		},
		showTerminalStatus: ({
			isComplete,
			error,
			tag
		}: TerminalToastArgs) => {
			return renderToast({
				toastId,
				fallbackTag: sourceTag,
				message: {
					title: isComplete ? 'Download complete' : 'Download failed',
					detail: displayName,
					meta: isComplete ? null : (error ? String(error) : 'Try again in a moment.')
				},
				options: {
					state: isComplete ? 1 : 3,
					sticky: false,
					spinner: false,
					duration: isComplete ? 3500 : 6500,
					hideMeta: !isComplete,
					tag
				}
			});
		}
	};
};
