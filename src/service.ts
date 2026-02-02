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
		console.log('[TTDB]', 'Attempting download', {
			filename: `${subFolder ? subFolder : ''}${filename}`, url: url
		});

		chrome.downloads.download({
			conflictAction: 'uniquify',
			filename: `${subFolder ? subFolder : ''}${filename}`,
			url: url,
			...(url.startsWith('http') && { method: 'GET' }),
			saveAs: false
		}, (itemId) => {
			chrome.downloads.onChanged.addListener((delta) => {
				if (itemId === delta.id) {
					console.log('[TTDB]', delta);

					if (delta.endTime || (delta.state && delta.state.current === 'complete')) {
						args.sendResponse({ itemId: itemId, success: true }); // Successful download
					} else if (delta.error) {
						args.sendResponse({ success: false, error: delta.error });
					}
				}
			});
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
 * Opens a new tab in Chrome
 * 
 * @param {object} args 
 */
const windowOpen = (args) => {
	chrome.tabs.create({
		url: args.data.url,
		active: args.data.active ? args.data.active : false
	}, () => { // May wanna handle errors here, not a priority for now however
		args.sendResponse({ success: true });
	});
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
		'optionsGet': optionsGet
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
