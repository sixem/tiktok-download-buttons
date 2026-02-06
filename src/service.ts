import { TTDB_OPTIONS } from './options';

// Extension settings exposed to the popup UI (via `optionsGet`).
//
// Note on defaults:
// Historically we used `false` as a sentinel. That made "Reset" confusing
// (it would literally reset text inputs to `false`). We now use real defaults
// and migrate legacy values in storage on startup.
const options: Record<string, { type: string; default: unknown; current: unknown }> = Object.fromEntries(
	Object.entries(TTDB_OPTIONS).map(([key, schema]) => ([key, { ...schema, current: null }]))
);

/** Active download sessions */
const globalState = globalThis as any;
globalState.downloadSessions = globalState.downloadSessions || new Map();

// Safety guard: the service worker can miss `downloads.onChanged` terminal signals (tab closes,
// browser restarts, service worker suspension, etc.). Keep downloadSessions bounded so we don't
// retain IDs forever within a long-lived worker.
//
// We prune opportunistically (on download requests + on change events) to avoid an always-on timer.
const MAX_DOWNLOAD_SESSIONS = 800;
const DOWNLOAD_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const pruneDownloadSessions = () => {
	const sessions: Map<number, any> = globalState.downloadSessions;
	if (!sessions || typeof sessions.size !== 'number' || sessions.size === 0) return;

	const nowMs = Date.now();

	// 1) TTL prune
	for (const [id, session] of sessions.entries()) {
		const startedAt = typeof session?.startedAt === 'number' ? session.startedAt : nowMs;
		if (nowMs - startedAt > DOWNLOAD_SESSION_TTL_MS) {
			sessions.delete(id);
		}
	}

	// 2) Cap prune (evict oldest)
	if (sessions.size > MAX_DOWNLOAD_SESSIONS) {
		const ordered = Array.from(sessions.entries())
			.map(([id, session]) => ({
				id,
				startedAt: typeof session?.startedAt === 'number' ? session.startedAt : 0
			}))
			.sort((a, b) => a.startedAt - b.startedAt);

		let idx = 0;
		while (sessions.size > MAX_DOWNLOAD_SESSIONS && idx < ordered.length) {
			sessions.delete(ordered[idx++].id);
		}
	}
};

/**
 * Install a single `downloads.onChanged` listener for this service worker.
 *
 * Why: Firefox MV3 service workers can be suspended between events. We avoid
 * holding open message channels waiting for `onChanged` and instead:
 * - respond to the content script immediately when a download *starts*
 * - send a separate runtime message back to the originating tab on complete/error
 */
const ensureDownloadChangeListener = () => {
	if (globalState.__ttdbDownloadChangeListenerInstalled) return;
	globalState.__ttdbDownloadChangeListenerInstalled = true;

	chrome.downloads.onChanged.addListener((delta) => {
		pruneDownloadSessions();

		if (!delta || typeof delta.id !== 'number') return;
		if (!globalState.downloadSessions || !globalState.downloadSessions.has(delta.id)) return;

		const session = globalState.downloadSessions.get(delta.id);
		const tabId = session && typeof session.tabId === 'number' ? session.tabId : null;

		const isComplete = !!delta.endTime || (delta.state && delta.state.current === 'complete');
		const isError = !!delta.error;

		if (!isComplete && !isError) return;

		globalState.downloadSessions.delete(delta.id);

		// Best-effort: if the tab navigated away, `sendMessage` can fail.
		if (typeof tabId === 'number') {
			const payload = isComplete
				? { task: 'downloadStatus', itemId: delta.id, state: 'complete' }
				: { task: 'downloadStatus', itemId: delta.id, state: 'error', error: delta.error?.current || delta.error };

			chrome.tabs.sendMessage(tabId, payload, () => {
				// Ignore lastError (tab not available / no content script).
				void chrome.runtime?.lastError;
			});
		}
	});
};

/** Set default storage values */
for (const [key, option] of Object.entries(options)) {
	chrome.storage.local.get(key, (result) => {
		const hasValue = !!result && Object.prototype.hasOwnProperty.call(result, key);
		const currentValue = hasValue ? result[key] : undefined;

		// Migrate legacy sentinel values + ensure defaults exist.
		const isValidText = option?.type === 'text' ? typeof currentValue === 'string' : true;
		const shouldSetDefault = !hasValue || !isValidText || currentValue === false || currentValue === null;
		if (!shouldSetDefault) return;

		chrome.storage.local.set({ [key]: option.default });
	});
}

/**
 * Options getter
 */
const optionsGet = (args) => {
	return args.sendResponse(options);
};

/**
 * Attempts to download a file using `browser.downloads.download`
 * 
 * @param {object} args 
 */
const fileDownload = async (args) => {
	let [filename, url, subFolder] = [
		args.data.filename,
		args.data.url,
		args.data.subFolder
	];

	if (subFolder && subFolder.length > 1 && !subFolder.endsWith('/')) {
		subFolder = subFolder + '/';
	}

	try {
		// Firefox does not reliably support downloading page-origin `blob:` URLs via the
		// downloads API. (Those blob URLs belong to the website, not the extension.)
		//
		// Chromium-based browsers generally *do* handle these, so only block on Firefox.
		const rt = (globalThis.browser ?? globalThis.chrome)?.runtime as any;
		const isFirefox = typeof rt?.getBrowserInfo === 'function';
		if (isFirefox && typeof url === 'string' && url.startsWith('blob:')) {
			console.warn('[TTDB]', 'Download blocked (blob URL)', {
				filename: `${subFolder ? subFolder : ''}${filename}`,
				url
			});
			args.sendResponse({
				success: false,
				error: 'Cannot download blob URLs from the background script.'
			});
			return;
		}

		console.log('[TTDB]', 'Attempting download', {
			filename: `${subFolder ? subFolder : ''}${filename}`, url: url
		});

		pruneDownloadSessions();
		ensureDownloadChangeListener();

		chrome.downloads.download({
			conflictAction: 'uniquify',
			filename: `${subFolder ? subFolder : ''}${filename}`,
			url: url,
			...(url.startsWith('http') && { method: 'GET' }),
			saveAs: false
		}, (itemId) => {
			const lastError = chrome.runtime?.lastError;
			if (lastError) {
				console.warn('[TTDB]', 'Download failed to start', {
					filename: `${subFolder ? subFolder : ''}${filename}`,
					url,
					error: lastError.message || String(lastError)
				});
				args.sendResponse({ success: false, error: lastError.message || String(lastError) });
				return;
			}

			if (typeof itemId !== 'number') {
				console.warn('[TTDB]', 'Download failed to start (no itemId)', {
					filename: `${subFolder ? subFolder : ''}${filename}`,
					url
				});
				args.sendResponse({ success: false, error: 'Download did not start (no itemId).' });
				return;
			}

			// Store the originating tab so we can notify it later when the download ends.
			const tabId = args.sender?.tab?.id;
			globalState.downloadSessions.set(itemId, {
				tabId: typeof tabId === 'number' ? tabId : null,
				startedAt: Date.now()
			});

			// IMPORTANT: respond immediately. Holding the message channel open until the
			// download completes is fragile in Firefox MV3 (service worker suspension).
			args.sendResponse({ itemId, success: true });
		});
	} catch (error) {
		args.sendResponse({ success: false, error });
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
const runtimeInfo = async (args) => {
	try {
		const rt = (globalThis.browser ?? globalThis.chrome)?.runtime as any;
		const isFirefox = typeof rt?.getBrowserInfo === 'function';

		// Keep the response minimal; content scripts only need stable booleans for behavior.
		args.sendResponse({
			success: true,
			isFirefox
		});
	} catch (error) {
		args.sendResponse({ success: false, error });
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
	const tasks = {
		'fileDownload': fileDownload,
		'fileShow': showDefaultFolder,
		'optionsGet': optionsGet,
		'runtimeInfo': runtimeInfo
	};

	if (tasks[data.task]) {
		tasks[data.task]({ // Perform task
			data,
			sender,
			sendResponse
		});
	}

	return true;
});
