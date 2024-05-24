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

/** Set default storage values */
Object.keys(options).forEach((key) => {
	chrome.storage.local.get(key, (result) => {
		if(result && !result.hasOwnProperty(key)) {
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
const fileDownload = (args) => {
	let [filename, url, subFolder] = [
		args.data.filename,
		args.data.url,
		args.data.subFolder
	];

	if(subFolder && subFolder.length > 1 && !subFolder.endsWith('/')) {
		subFolder = (subFolder + '/');
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
		}, (itemId) =>
		{
			chrome.downloads.onChanged.addListener((delta) => {
				if(itemId === delta.id) {
					console.log('[TTDB]', delta);

					if(delta.endTime || (delta.state && delta.state.current === 'complete')) {
						// Successful download
						args.sendResponse({ itemId: itemId, success: true });
					} else if(delta.error) {
						// Error encountered
						args.sendResponse({ success: false });
					}
				}      
			});
		});
	} catch(error) {
		// Error encountered
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
 * `onMessage` listener
 */
chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
	// Task IDs and their corresponding methods
	const tasks = {
		'fileDownload': fileDownload,
		'windowOpen': windowOpen,
		'fileShow': showDefaultFolder,
		'optionsGet': optionsGet,
		'fetch': serviceFetch
	};

	if(tasks[data.task])
	{
		tasks[data.task]({ // Perform task
			data,
			sender,
			sendResponse
		});
	}

	return true;
});