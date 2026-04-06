// Pending download session store.
//
// This module keeps long-lived download bookkeeping out of the coordinator:
// - tracks in-flight sessions by browser `itemId`
// - cleans up object URLs and timers
// - listens for `downloadStatus` events from the service worker

import { TTDB } from '@/content/state';
import { CHROMIUM_DOWNLOAD } from './constants';
import { PENDING_DOWNLOAD } from './constants';
import type { DownloadMethodTag } from './download-method';

export type PendingDownloadSession = {
	objectUrl: string | null;
	startedAtMs: number;
	toastId: string;
	filename: string;
	sourceTag: DownloadMethodTag | string | null;
	originalUrl: string;
	hasRetried: boolean;
	revokeTimerId: number | null;
};

type DownloadStatusTerminalPayload = {
	itemId: number;
	state: string;
	error: unknown;
	session: PendingDownloadSession;
};

type DownloadStatusRetryPayload = {
	itemId: number;
	error: unknown;
	session: PendingDownloadSession;
};

type DownloadStatusHandlers = {
	onTerminalStatus?: (payload: DownloadStatusTerminalPayload) => void;
	onRetryRequested?: (payload: DownloadStatusRetryPayload) => void;
};

type SuggestDownloadStartedPayload = {
	itemId: number;
	session: Omit<PendingDownloadSession, 'revokeTimerId'>;
};

const globalState = globalThis as any;

// Store on `globalThis` so hot reload/content reinjection can keep state.
const pendingDownloadSessions: Map<number, PendingDownloadSession> = globalState.__ttdbPendingDownloadObjectUrls || new Map();
const statusHandlers: DownloadStatusHandlers = globalState.__ttdbDownloadStatusHandlers || {};

globalState.__ttdbPendingDownloadObjectUrls = pendingDownloadSessions;
globalState.__ttdbDownloadStatusHandlers = statusHandlers;

const clearSessionResources = (session: PendingDownloadSession) => {
	if (typeof session?.revokeTimerId === 'number') {
		clearTimeout(session.revokeTimerId);
	}

	if (typeof session?.objectUrl === 'string') {
		try {
			URL.revokeObjectURL(session.objectUrl);
		} catch (_) {
			// Best-effort cleanup.
		}
	}
};

const dropSession = (itemId: number, session: PendingDownloadSession) => {
	clearSessionResources(session);
	pendingDownloadSessions.delete(itemId);
};

const shouldRetryWithInPageFetch = (error: unknown) => {
	if (!error) return false;
	const text = String(error).toUpperCase();
	return text.includes('SERVER_FORBIDDEN') || text.includes('FORBIDDEN');
};

export const prunePendingDownloadSessions = (reason: string) => {
	const nowMs = Date.now();

	// 1) TTL pruning.
	for (const [itemId, session] of pendingDownloadSessions.entries()) {
		const startedAtMs = typeof session?.startedAtMs === 'number' ? session.startedAtMs : nowMs;
		if (nowMs - startedAtMs > PENDING_DOWNLOAD.sessionTtlMs) {
			dropSession(itemId, session);
		}
	}

	// 2) Cap pruning. Prefer removing sessions without object URLs first.
	if (pendingDownloadSessions.size > PENDING_DOWNLOAD.maxSessions) {
		const toEvictNoObjectUrl: Array<{ itemId: number; startedAtMs: number; session: PendingDownloadSession }> = [];
		const toEvictWithObjectUrl: Array<{ itemId: number; startedAtMs: number; session: PendingDownloadSession }> = [];

		for (const [itemId, session] of pendingDownloadSessions.entries()) {
			const startedAtMs = typeof session?.startedAtMs === 'number' ? session.startedAtMs : 0;
			const bucket = typeof session?.objectUrl === 'string' ? toEvictWithObjectUrl : toEvictNoObjectUrl;
			bucket.push({ itemId, startedAtMs, session });
		}

		const sortByOldest = (a: { startedAtMs: number }, b: { startedAtMs: number }) => a.startedAtMs - b.startedAtMs;
		toEvictNoObjectUrl.sort(sortByOldest);
		toEvictWithObjectUrl.sort(sortByOldest);

		const evictionOrder = [...toEvictNoObjectUrl, ...toEvictWithObjectUrl];
		let idx = 0;
		while (pendingDownloadSessions.size > PENDING_DOWNLOAD.maxSessions && idx < evictionOrder.length) {
			const target = evictionOrder[idx++];
			dropSession(target.itemId, target.session);
		}
	}

	TTDB.LOG?.ns?.('download')?.debug?.('pruned pending download sessions', {
		reason,
		remaining: pendingDownloadSessions.size
	});
};

export const registerPendingDownloadSession = ({
	itemId,
	session,
	safetyTimeoutMs = null
}: {
	itemId: number;
	session: Omit<PendingDownloadSession, 'revokeTimerId'>;
	safetyTimeoutMs?: number | null;
}) => {
	const pendingSession: PendingDownloadSession = {
		...session,
		revokeTimerId: null
	};

	if (typeof safetyTimeoutMs === 'number' && safetyTimeoutMs > 0) {
		pendingSession.revokeTimerId = setTimeout(() => {
			const stillPending = pendingDownloadSessions.get(itemId);
			if (!stillPending) return;

			dropSession(itemId, stillPending);
		}, safetyTimeoutMs) as unknown as number;
	}

	pendingDownloadSessions.set(itemId, pendingSession);
};

export const ensureDownloadStatusListener = (handlers: DownloadStatusHandlers = {}) => {
	if (typeof handlers.onTerminalStatus === 'function') {
		statusHandlers.onTerminalStatus = handlers.onTerminalStatus;
	}

	if (typeof handlers.onRetryRequested === 'function') {
		statusHandlers.onRetryRequested = handlers.onRetryRequested;
	}

	if (globalState.__ttdbDownloadStatusListenerInstalled) return;
	globalState.__ttdbDownloadStatusListenerInstalled = true;

	chrome.runtime.onMessage.addListener((data) => {
		prunePendingDownloadSessions('downloadStatus:message');

		if (!data || typeof data !== 'object') return;
		if ((data as any).task === 'suggestDownloadStarted') {
			const payload = data as any as SuggestDownloadStartedPayload & { task: 'suggestDownloadStarted' };
			if (typeof payload.itemId !== 'number' || !payload.session) return;

			registerPendingDownloadSession({
				itemId: payload.itemId,
				session: payload.session,
				safetyTimeoutMs: typeof payload.session.objectUrl === 'string'
					? CHROMIUM_DOWNLOAD.safetyRevokeMs
					: null
			});
			return;
		}

		if ((data as any).task !== 'downloadStatus') return;

		const itemId = (data as any).itemId;
		if (typeof itemId !== 'number') return;

		const session = pendingDownloadSessions.get(itemId);
		if (!session) return;

		const state = (data as any).state;
		const error = (data as any).error || null;
		const isError = state === 'error';

		clearSessionResources(session);

		if (isError && shouldRetryWithInPageFetch(error) && session.originalUrl && !session.hasRetried) {
			session.hasRetried = true;
			pendingDownloadSessions.delete(itemId);
			prunePendingDownloadSessions('downloadStatus:retry');

			statusHandlers.onRetryRequested?.({
				itemId,
				error,
				session
			});
			return;
		}

		pendingDownloadSessions.delete(itemId);
		prunePendingDownloadSessions('downloadStatus:terminal');

		statusHandlers.onTerminalStatus?.({
			itemId,
			state,
			error,
			session
		});
	});
};
