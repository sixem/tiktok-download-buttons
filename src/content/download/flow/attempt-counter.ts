// Bounded per-video attempt counter for download logging/debugging.
//
// Long TikTok sessions can touch thousands of posts. Keeping the key order beside
// the counter map lets us evict old entries deterministically instead of retaining
// every video key for the life of the tab.

import { TTDB } from '@/content/core/state';
import { DOWNLOAD_HOOK } from '@/content/download/constants';

export type AttemptCounterState = {
	downloadAttemptOrder?: string[];
	downloadAttemptsByVideo: Record<string, number>;
};

export const nextAttemptIdForKey = (
	attemptKey: string,
	{
		state = TTDB.stats,
		maxKeys = DOWNLOAD_HOOK.maxAttemptKeys
	}: {
		state?: AttemptCounterState;
		maxKeys?: number;
	} = {}
) => {
	const attemptsByVideo = state.downloadAttemptsByVideo;

	state.downloadAttemptOrder = state.downloadAttemptOrder || [];
	const attemptOrder = state.downloadAttemptOrder;
	const isFirstAttemptForVideo = !Object.hasOwn(attemptsByVideo, attemptKey);
	if (isFirstAttemptForVideo) {
		attemptOrder.push(attemptKey);
	}

	while (attemptOrder.length > maxKeys) {
		const oldest = attemptOrder.shift();
		if (!oldest) continue;
		delete attemptsByVideo[oldest];
	}

	const nextAttemptId = (attemptsByVideo[attemptKey] || 0) + 1;
	attemptsByVideo[attemptKey] = nextAttemptId;
	return nextAttemptId;
};
