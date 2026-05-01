import { describe, expect, it } from 'vitest';
import {
	nextAttemptIdForKey,
	type AttemptCounterState
} from '@/content/download/flow/attempt-counter';

describe('nextAttemptIdForKey', () => {
	it('increments repeated attempts for the same video key', () => {
		const state: AttemptCounterState = {
			downloadAttemptsByVideo: {}
		};

		expect(nextAttemptIdForKey('video-a', { state, maxKeys: 10 })).toBe(1);
		expect(nextAttemptIdForKey('video-a', { state, maxKeys: 10 })).toBe(2);
		expect(state.downloadAttemptOrder).toEqual(['video-a']);
	});

	it('evicts the oldest retained video key when the counter reaches its cap', () => {
		const state: AttemptCounterState = {
			downloadAttemptsByVideo: {}
		};

		nextAttemptIdForKey('video-a', { state, maxKeys: 2 });
		nextAttemptIdForKey('video-b', { state, maxKeys: 2 });
		nextAttemptIdForKey('video-a', { state, maxKeys: 2 });
		nextAttemptIdForKey('video-c', { state, maxKeys: 2 });

		expect(state.downloadAttemptOrder).toEqual(['video-b', 'video-c']);
		expect(state.downloadAttemptsByVideo).toEqual({
			'video-b': 1,
			'video-c': 1
		});
	});
});
