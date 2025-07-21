/**
 * The method `chrome.downloads.download` does not work with the option:
 *      "Ask where to save each file before downloading" enabled.
 * If the option is disabled (chrome://settings/downloads), this feature will work fine.
 * 
 * This is an issue with the actual chrome API (only MV3, not MV2) — see:
 *      [https://bugs.chromium.org/p/chromium/issues/detail?id=1173497]
 *      [https://bugs.chromium.org/p/chromium/issues/detail?id=1246717]
 * 
 * Anyways...
 *      This method is prioritized because it's very useful if it works, but fallbacks are needed.
 */

/** Default options for the addon to use */
const options = {
	'download-fallback-tab-focus': {
		type: 'toggle',
		default: true,
		current: null
	},
	'download-subfolder-path': {
		type: 'text',
		default: false,
		current: null
	},
	'download-naming-template': {
		type: 'text',
		default: false,
		current: null
	}
};

/** Active download sessions */
globalThis.downloadSessions = globalThis.downloadSessions || new Map();

/** Set default storage values */
Object.keys(options).forEach((key) => {
	chrome.storage.local.get(key, (result) => {
		if (result && !result.hasOwnProperty(key)) {
			let value = new Object();
			value[key] = options[key].default;
			chrome.storage.local.set(value);
		}
	});
});

/**
 * Options getter
 */
const optionsGet = (args) => {
	return args.sendResponse(options);
};

/**
 * Attempts to download a file using `chrome.downloads.download`
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
		const probe = await fetch(url, {
			method: 'HEAD',
			mode: 'cors',
			credentials: 'include',
			referrerPolicy: 'strict-origin-when-cross-origin'
		});

		const contentType = probe.headers.get('Content-Type') || '';

		const isValid = probe.ok
			&& (contentType.includes('video/') || contentType.includes('application/octet-stream'))
			&& parseInt(probe.headers.get('Content-Length') || '0') > 1000;

		if (!isValid) {
			console.warn(`Blob fallback probe failed for ${url} (${contentType} - ${probe.status})`, contentType);
			args.sendResponse({ success: false, error: 'Invalid video response' });
			return;
		}
	} catch (probeError) {
		console.error('[TTDB] Probe error:', probeError);
		args.sendResponse({ success: false, error: 'Probe failed' });
		return;
	}

	try {
		console.log('[TTDB]', 'Attempting download', {
			filename: `${subFolder ? subFolder : ''}${filename}`,
			url: url
		});

		chrome.downloads.download({
			conflictAction: 'uniquify',
			filename: `${subFolder ? subFolder : ''}${filename}`,
			url: url,
			method: 'GET',
			saveAs: false
		}, (itemId) => {
			chrome.downloads.onChanged.addListener((delta) => {
				if (itemId === delta.id) {
					console.log('[TTDB]', delta);

					if (delta.endTime || (delta.state && delta.state.current === 'complete')) {
						args.sendResponse({ itemId: itemId, success: true }); // Successful download
					} else if (delta.error) {
						args.sendResponse({ success: false });
					}
				}
			});
		});
	} catch (error) {
		args.sendResponse({ success: false });
	}
};

/**
 * Opens the default download folder
 */
const showDefaultFolder = () => {
	chrome.downloads.showDefaultFolder();
};

/**
 * Opens a new tab in Chrome
 * 
 * @param {object} args 
 */
const windowOpen = (args) => {
	chrome.tabs.create({
		url: args.data.url,
		active: args.data.active ? args.data.active : false
	}, () => { // May wanna handle errors here, not a priority for now however
		args.sendResponse({
			success: true
		});
	});
};

/**
 * Fetching function
 * 
 * @param {object} args 
 */
const serviceFetch = async (args) => {
	const url = args.data.url;
	const options = args.data.options || {};

	return fetch(url, options).then((response) => {
		return response.json();
	}).then((data) => {
		args.sendResponse({ data: data, error: false });
	}).catch((error) => {
		console.info('Caught a fetching error:', error);
		args.sendResponse({ data: null, error: error });
	})
};

/**
 * Handles blob downloads
 *
 * @param {{data: object, sendResponse: Function}} args
 */
const blobChunkDownload = async ({ data, sendResponse }) => {
	const { sessionId, filename, subFolder = '', chunk, done } = data;
	const sessions = globalThis.downloadSessions;

	const ok = extra => sendResponse({ success: true, ...extra });
	const fail = error => sendResponse({ success: false, error });

	if (!sessions.has(sessionId) && chunk === null && !done) {
		sessions.set(sessionId, { chunks: [], filename, subFolder });
		return ok();
	}

	const session = sessions.get(sessionId);

	if (!session) {
		return fail('Invalid download session');
	}

	if (chunk !== null) {
		session.chunks.push(
			Uint8Array.from(atob(chunk), c => c.charCodeAt(0)).buffer
		);
		
		return ok();
	}

	if (!done) {
		return fail('Invalid message');
	}

	try {
		const blob   = new Blob(session.chunks);
		const bytes  = new Uint8Array(await blob.arrayBuffer());
		const binary = new Array(bytes.length);

		for (let i = 0; i < bytes.length; i++) {
			binary[i] = String.fromCharCode(bytes[i]);
		}

		const dataUrl  = `data:video/mp4;base64,${btoa(binary.join(''))}`;
		const fullName = session.subFolder
			? `${session.subFolder.replace(/\/?$/, '/')}${session.filename}`
			: session.filename;

		const downloadId = await new Promise((resolve, reject) => {
			chrome.downloads.download(
				{ url: dataUrl, filename: fullName, conflictAction: 'uniquify', saveAs: false },
				id => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(id)
			);
		});

		await new Promise(resolve => {
			const listener = delta => {
				if (delta.id === downloadId && delta.state?.current === 'complete') {
					chrome.downloads.onChanged.removeListener(listener);
					resolve();
				}
			};

			chrome.downloads.onChanged.addListener(listener);
		});

		ok();
	} catch (err) {
		console.error('[TTDB] Blob download error:', err);
		fail(err.message);
	} finally {
		sessions.delete(sessionId);
	}
};


/**
 * `onMessage` listener
 */
chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
	// Task IDs and their corresponding methods
	const tasks = {
		'fileDownload': fileDownload,
		'windowOpen': windowOpen,
		'fileShow': showDefaultFolder,
		'optionsGet': optionsGet,
		'fetch': serviceFetch,
		'blobChunkDownload': blobChunkDownload
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