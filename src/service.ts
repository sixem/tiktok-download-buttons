// Service worker entrypoint.
//
// Important constraint:
// - MV3 service workers (and content scripts) are loaded as classic scripts.
// - That means they cannot use ESM `import ... from ...` unless the manifest opts into modules.
//
// Vite/Rollup can emit `import` statements when entrypoints share modules. Keep
// service-worker helpers local until the manifest/build explicitly supports module workers.

import type {
	DownloadStatusMessage,
	FileDownloadMessage,
	FileDownloadResponse,
	RuntimeInfoResponse,
	RuntimeTask
} from '@/types';

const SERVICE = {
	downloadSessions: {
		maxEntries: 800,
		ttlMs: 12 * 60 * 60 * 1000 // 12 hours
	}
} as const;

type DownloadSession = {
	tabId: number | null;
	startedAt: number;
	browser: 'firefox' | 'chromium';
};

type ServiceGlobalState = typeof globalThis & {
	downloadSessions: Map<number, DownloadSession>;
	__ttdbDownloadChangeListener?: (delta: any) => void;
	__ttdbDownloadChangeListenerInstalled?: boolean;
};

type ServiceTaskArgs<TData = Record<string, unknown>> = {
	data: TData;
	sender?: {
		tab?: {
			id?: number;
		};
	};
	sendResponse: (response?: unknown) => void;
};

// Active TTDB download sessions.
//
// Chromium and Brave download events are global to the browser. Registering
// `chrome.downloads.onChanged` can make unrelated downloads consult/wake this
// extension and delay filename dialogs or browser download UI, so the listener
// below is installed only while we have TTDB item IDs to watch.
const globalState = globalThis as ServiceGlobalState;
globalState.downloadSessions = globalState.downloadSessions || new Map();

// Safety guard: the service worker can miss `downloads.onChanged` terminal signals (tab closes,
// browser restarts, service worker suspension, etc.). Keep downloadSessions bounded so we don't
// retain IDs forever within a long-lived worker.
//
// We prune opportunistically (on download requests + on change events) to avoid an always-on timer.
const pruneDownloadSessions = () => {
	const sessions = globalState.downloadSessions;
	if (!sessions || typeof sessions.size !== 'number' || sessions.size === 0) return;

	const nowMs = Date.now();

	// 1) TTL prune
	for (const [id, session] of sessions.entries()) {
		const startedAt = typeof session?.startedAt === 'number' ? session.startedAt : nowMs;
		if (nowMs - startedAt > SERVICE.downloadSessions.ttlMs) {
			sessions.delete(id);
		}
	}

	// 2) Cap prune (evict oldest)
	if (sessions.size > SERVICE.downloadSessions.maxEntries) {
		const ordered = Array.from(sessions.entries())
			.map(([id, session]) => ({
				id,
				startedAt: typeof session?.startedAt === 'number' ? session.startedAt : 0
			}))
			.sort((a, b) => a.startedAt - b.startedAt);

		let idx = 0;
		while (sessions.size > SERVICE.downloadSessions.maxEntries && idx < ordered.length) {
			sessions.delete(ordered[idx++].id);
		}
	}
};

const hasDownloadSessions = () => {
	const sessions = globalState.downloadSessions;
	return !!sessions && typeof sessions.size === 'number' && sessions.size > 0;
};

const removeDownloadChangeListenerIfIdle = () => {
	if (hasDownloadSessions()) return;
	if (!globalState.__ttdbDownloadChangeListenerInstalled) return;
	if (typeof globalState.__ttdbDownloadChangeListener !== 'function') return;

	chrome.downloads.onChanged.removeListener(globalState.__ttdbDownloadChangeListener);
	globalState.__ttdbDownloadChangeListenerInstalled = false;
};

const buildDownloadPath = (filename, subFolder) => {
	let prefix = typeof subFolder === 'string' ? subFolder : '';
	if (prefix && prefix.length > 1 && !prefix.endsWith('/')) {
		prefix = `${prefix}/`;
	}
	return `${prefix}${filename}`;
};

/**
 * Install one minimal `downloads.onChanged` listener while TTDB downloads are active.
 *
 * Firefox MV3 service workers can be suspended between events. We avoid
 * holding open message channels waiting for `onChanged` and instead:
 * - respond to the content script immediately when a download *starts*
 * - send a separate runtime message back to the originating tab on complete/error
 *
 * Chromium/Brave download change events are global, so this handler does the least
 * possible work for unrelated IDs and removes itself as soon as TTDB has no sessions.
 */
const ensureDownloadChangeListener = () => {
	if (globalState.__ttdbDownloadChangeListenerInstalled) return;

	if (typeof globalState.__ttdbDownloadChangeListener !== 'function') {
		globalState.__ttdbDownloadChangeListener = (delta: any) => {
			// Fast path for unrelated browser downloads. This is the important Chromium
			// guard: ignore global events unless the ID belongs to a TTDB-started download.
			if (!delta || typeof delta.id !== 'number') return;
			if (!globalState.downloadSessions?.has(delta.id)) return;

			const session = globalState.downloadSessions.get(delta.id);
			const tabId = session && typeof session.tabId === 'number' ? session.tabId : null;

			const isComplete = !!delta.endTime || (delta.state && delta.state.current === 'complete');
			const isError = !!delta.error;

			if (!isComplete && !isError) return;

			globalState.downloadSessions.delete(delta.id);

			// Best-effort: if the tab navigated away, `sendMessage` can fail.
			if (typeof tabId === 'number') {
				const payload: DownloadStatusMessage = isComplete
					? { task: 'downloadStatus', itemId: delta.id, state: 'complete' }
					: { task: 'downloadStatus', itemId: delta.id, state: 'error', error: delta.error?.current || delta.error };

				chrome.tabs.sendMessage(tabId, payload, () => {
					// Ignore lastError (tab not available / no content script).
					void chrome.runtime?.lastError;
				});
			}

			pruneDownloadSessions();
			removeDownloadChangeListenerIfIdle();
		};
	}

	chrome.downloads.onChanged.addListener(globalState.__ttdbDownloadChangeListener);
	globalState.__ttdbDownloadChangeListenerInstalled = true;
};

/**
 * Attempts to download a file using `browser.downloads.download`
 * 
 * @param {object} args 
 */
const fileDownload = async (args: ServiceTaskArgs<FileDownloadMessage>) => {
	let [filename, url, subFolder] = [
		args.data.filename,
		args.data.url,
		args.data.subFolder
	];
	const referer = typeof args.data.referer === 'string' ? args.data.referer : '';

	if (subFolder && subFolder.length > 1 && !subFolder.endsWith('/')) {
		subFolder = `${subFolder}/`;
	}

	try {
		// Firefox does not reliably support downloading page-origin `blob:` URLs via the
		// downloads API. (Those blob URLs belong to the website, not the extension.)
		//
		// Chromium-based browsers generally *do* handle these, so only block on Firefox.
		const rt = ((globalThis as any).browser ?? (globalThis as any).chrome ?? chrome)?.runtime as any;
		const isFirefox = typeof rt?.getBrowserInfo === 'function';
		if (isFirefox && typeof url === 'string' && url.startsWith('blob:')) {
			console.warn('[TTDB]', 'Download blocked (blob URL)', {
				filename: buildDownloadPath(filename, subFolder),
				url
			});
			const response: FileDownloadResponse = {
				success: false,
				error: 'Cannot download blob URLs from the background script.'
			};
			args.sendResponse(response);
			return;
		}

		console.log('[TTDB]', 'Attempting download', {
			filename: buildDownloadPath(filename, subFolder), url: url
		});

		// Clear stale watched IDs before starting another download. If that leaves no
		// TTDB sessions, the global Chromium/Brave listener is removed.
		pruneDownloadSessions();
		removeDownloadChangeListenerIfIdle();

		// Firefox background downloads come from the extension context instead of the
		// page, so some signed TikTok URLs need an explicit referer to succeed.
		const downloadHeaders = [];
		if (isFirefox && /^https?:/i.test(referer)) {
			downloadHeaders.push({
				name: 'Referer',
				value: referer
			});
		}

		chrome.downloads.download({
			conflictAction: 'uniquify',
			filename: buildDownloadPath(filename, subFolder),
			url: url,
			...(url.startsWith('http') && { method: 'GET' }),
			...(downloadHeaders.length ? { headers: downloadHeaders } : {}),
			saveAs: false
		}, (itemId) => {
			const lastError = chrome.runtime?.lastError;
			if (lastError) {
				console.warn('[TTDB]', 'Download failed to start', {
					filename: buildDownloadPath(filename, subFolder),
					url,
					error: lastError.message || String(lastError)
				});
				const response: FileDownloadResponse = { success: false, error: lastError.message || String(lastError) };
				args.sendResponse(response);
				return;
			}

			if (typeof itemId !== 'number') {
				console.warn('[TTDB]', 'Download failed to start (no itemId)', {
					filename: buildDownloadPath(filename, subFolder),
					url
				});
				const response: FileDownloadResponse = { success: false, error: 'Download did not start (no itemId).' };
				args.sendResponse(response);
				return;
			}

			// Store only the originating tab and start time. We only care about terminal
			// download state, not progress updates. Firefox uses errors for retry/fallback;
			// Chromium uses completion/error to update the UI while keeping the listener
			// installed only during active TTDB downloads.
			const tabId = args.sender?.tab?.id;
			globalState.downloadSessions.set(itemId, {
				tabId: typeof tabId === 'number' ? tabId : null,
				startedAt: Date.now(),
				browser: isFirefox ? 'firefox' : 'chromium'
			});
			ensureDownloadChangeListener();

			// IMPORTANT: respond immediately. Holding the message channel open until the
			// download completes is fragile in Firefox MV3 (service worker suspension).
			const response: FileDownloadResponse = { itemId, success: true };
			args.sendResponse(response);
		});
	} catch (error) {
		const response: FileDownloadResponse = { success: false, error };
		args.sendResponse(response);
	}
};

/**
 * Exposes runtime/browser info to the content script for robust branching.
 *
 * Why:
 * - Websites can (and do) shim/override globals like `navigator.userAgent`.
 * - The service worker runs in the extension context and can reliably detect Firefox via
 *   `runtime.getBrowserInfo`.
 */
const runtimeInfo = async (args: ServiceTaskArgs) => {
	try {
		const rt = ((globalThis as any).browser ?? (globalThis as any).chrome ?? chrome)?.runtime as any;
		const isFirefox = typeof rt?.getBrowserInfo === 'function';

		// Keep the response minimal; content scripts only need stable booleans for behavior.
		const response: RuntimeInfoResponse = {
			success: true,
			isFirefox,
			isChromium: !isFirefox
		};
		args.sendResponse(response);
	} catch (error) {
		const response: RuntimeInfoResponse = { success: false, error };
		args.sendResponse(response);
	}
};

/**
 * Opens the default download folder
 */
const showDefaultFolder = () => {
	chrome.downloads.showDefaultFolder();
};

/**
 * `onMessage` listener
 */
chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
	// Task IDs and their corresponding methods
	const tasks: Partial<Record<RuntimeTask, (args: ServiceTaskArgs<any>) => unknown>> = {
		'fileDownload': fileDownload,
		'fileShow': showDefaultFolder,
		'runtimeInfo': runtimeInfo
	};

	const task = data?.task as RuntimeTask | undefined;
	if (task && tasks[task]) {
		tasks[task]({ // Perform task
			data,
			sender,
			sendResponse
		});
	}

	return true;
});
