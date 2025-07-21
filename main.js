(async () => {
	const TTDB = {}, API = {}, EXPR = {}, UTIL = {}, SPLASH = {}, ACTIVE = {};

	TTDB.observers = {};
	TTDB.timers = {};

	/**
	 * Interval object
	 * 
	 * Sets the amount of update attempts that should be done
	 */
	TTDB.interval = {
		counter: 50,
		delay: 250
	};

	/**
	 * Different item modes (mode="X")
	 */
	TTDB.MODE = {
		FEED: '0',
		GRID: '1',
		BROWSER: '2',
		SWIPER_SLIDE: '3', /** Is this an obsolete mode? */
		BASIC_PLAYER: '4',
		SHARE_OVERLAY: '-1'
	};

	/**
	 * Sets the amount of item checks to do
	 * 
	 * @param {integer} count 
	 */
	TTDB.setInterval = (count) => {
		if (TTDB.interval.counter < count) {
			TTDB.interval.counter = count
		}
	};

	ACTIVE.running = {};

	/**
	 * Log to console
	 * 
	 * @param  {...any} args 
	 */
	const pipe = (...args) => {
		console.info('[TTDB]', ...args)
	};

	/**
	 * Dipatches an event on an element
	 * 
	 * @param {HTMLElement} element 
	 * @param {class}       eventType 
	 * @param {string}      event 
	 */
	UTIL.dispatchEvent = (element, eventType, event) => {
		element.dispatchEvent(new eventType(event, {
			bubbles: true,
			cancelable: true,
			view: window
		}));
	};

	/**
	 * Validates that a response is video content
	 * 
	 * @param {Response} t 
	 */
	UTIL.validateVideoRequest = (t) => {
		const contentType = t.headers.get('Content-Type') || '';

		return t.ok && (contentType.includes('video/')
				|| contentType.includes('application/octet-stream'))
				&& +t.headers.get('Content-Length') > 1000;
	};

	/**
	 * Checks whether the current browser environment is Chromium or not
	 */
	UTIL.isChromium = () => {
		const rt = (globalThis.browser ?? globalThis.chrome)?.runtime;

		if (rt?.getBrowserInfo) return false;
		if (navigator.userAgentData?.brands) {
			return navigator.userAgentData.brands
				.some(b => /Chrom(e|ium)|Edge|Opera/i.test(b.brand));
		}

		return /Chrome|Chromium|Edg|OPR|Brave|Vivaldi/i.test(navigator.userAgent);
	};


	/**
	 * Truncates a string
	 * 
	 * @param {string}  string 
	 * @param {integer} n 
	 */
	UTIL.truncateString = (string, n) => {
		return (string.length > n) ? string.substr(0, n - 1) : string;
	};

	/**
	 * Generates a random string from a character set
	 * 
	 * @param {string}  characters 
	 * @param {integer} length 
	 */
	UTIL.ranGen = (charSet, length = 16) => {
		let result = '';
		const setLength = charSet.length;

		for (let i = 0; i < length; i++) {
			result += charSet.charAt(Math.floor(Math.random() * setLength));
		} return result;
	};

	/**
	 * Generates a random integer between min and max
	 * 
	 * @param {integer} min 
	 * @param {integer} max 
	 */
	UTIL.ranInt = (min, max) => {
		return Math.floor(Math.random() * (max - min + 1) + min);
	};

	/**
	 * Attempts to sanitize a filename
	 * 
	 * @param {string} string 
	 */
	UTIL.sanitizeFilename = (string) => {
		/**
		 * Regex ranges and characters:
		 * 
		 * \u3040-\u30ff — Hiragana and katakana
		 * \u3400-\u4dbf — CJK unified ideographs extension A
		 * \u4e00-\u9fff — CJK unified ideographs
		 * \uf900-\ufaff — CJK compatibility ideographs
		 * \uff66-\uff9f — Half-width katakana
		 * \wа-я		 — Cyrillic
		 * 0-9a-zA-Z 	 — Numbers and latin letters
		 * -._ #()\[\] 	 — Other characters
		 */

		string = string.replace(
			/[^\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\wа-я0-9a-zA-Z-._ #()\[\]]/g, ''
		).replace(/\s\s+/g, ' ').trim();

		// Remove any leading dots
		while (string[0] === '.') {
			string = string.substring(1);
		}

		// Filename limit is about 250, so we'll shorten any super long filenames
		return (string.length - 4) >= 246 ? `${string.replace('.mp4', '').substring(0, 246).trim()}.mp4` : string;
	}

	/**
	 * Checks the existance of a key in an object
	 * 
	 * @param {object}  obj 
	 * @param {string}  level 
	 * @param {...any}  rest 
	 * @returns 
	 */
	UTIL.checkNested = (obj, level, ...rest) => {
		if (obj === undefined) {
			return false;
		}

		if (rest.length == 0 && obj.hasOwnProperty(level)) {
			return true;
		}

		return UTIL.checkNested(obj[level], ...rest);
	};

	/**
	 * Traverses an object for a key, then gets that value
	 * 
	 * Returns an undefined value if not found
	 * 
	 * @param {object} obj 
	 * @param {string} needle 
	 */
	UTIL.traverseObj = (obj, needles, index = 0) => {
		if (obj !== null && typeof obj === "object" && index < needles.length) {
			const needle = needles[index];

			for (const key of Object.keys(obj)) {
				if (key === needle) {
					if (index === needles.length - 1) {
						return obj[key];
					}
					return UTIL.traverseObj(obj[key], needles, index + 1);
				}
			}

			for (const key of Object.keys(obj)) {
				const result = UTIL.traverseObj(obj[key], needles, index);
				if (result !== undefined) {
					return result;
				}
			}
		}

		return undefined;
	}

	/**
	 * Fetches a stored setting
	 * 
	 * @param {string} key 
	 */
	const getStoredSetting = async (key) => {
		const stored = await chrome.storage.local.get(key);

		if (stored && stored.hasOwnProperty(key)) {
			return stored[key];
		}

		return null;
	};

	/** Matches `https://www.tiktok.com/@user/video/123456789` URLs */
	EXPR.vanillaVideoUrl = (haystack, options = {}) => {
		let expression = ('https?:\/\/(?:www\.)?tiktok\.com\/@([^\/]+)\/video\/([0-9]+)');

		if (options.strict) {
			expression = ('^' + expression + '$');
		}

		const matches = new RegExp(expression).exec(haystack);
		return matches ? matches : null;
	};

	/**
	 * Creates a numerical hash for a given input
	 * 
	 * @param {string} input 
	 */
	ACTIVE.hash = (input) => {
		return input.split('').reduce((hash, char) => (hash * 33) ^ char.charCodeAt(0), 5381) >>> 0
	};


	/**
	 * Creates a new download UI container
	 */
	ACTIVE.create = () => {
		if (document.body) {
			const container = document.createElement('div');

			container.classList.add('ttdb_downloading-active');
			container.textContent = '';

			document.body.appendChild(container);

			return container;
		}
	};

	/**
	 * Gets and returns the current download UI container
	 * If one does not exist, it will be created
	 */
	ACTIVE.getContainer = () => {
		const container = document.body.querySelector('div.ttdb_downloading-active');
		return container ? container : ACTIVE.create();
	};

	/**
	 * Helper function that creates a new download UI item
	 */
	ACTIVE.createItem = (hash, item) => {
		const element = document.createElement('div');
		const progress = document.createElement('div');

		element.classList.add('item');
		progress.classList.add('progress');

		element.setAttribute('id', hash);
		element.innerText = item.name;
		element.appendChild(progress);

		ACTIVE.getContainer().appendChild(element);

		element.style.opacity = '1';

		return element;
	}

	/**
	 * Refreshes the download items in the UI (updating percentages etc.)
	 */
	ACTIVE.refreshUi = () => {
		const activeHashes = Object.keys(ACTIVE.running);
		const container = ACTIVE.getContainer();

		// Clear or hide container if no active downloads
		if (!activeHashes.length) {
			container.innerHTML = '';
			return DOM.setStyle(container, { opacity: '0' });
		}

		DOM.setStyle(container, { opacity: '1' });

		for (const hash of activeHashes) {
			const { item } = ACTIVE.running[hash];
			const element = container.querySelector(`:scope > div[id="${hash}"]`) || ACTIVE.createItem(hash, item);
			const progress = element.querySelector(':scope > div.progress');
			const percentage = Math.ceil(item.percentage);

			if (progress) {
				progress.style.minWidth = `${percentage}%`;
			}

			if (percentage >= 100 && !element.dataset.completing) {
				element.dataset.completing = true;
				setTimeout(() => {
					element.style.opacity = '0';
					setTimeout(() => {
						delete ACTIVE.running[hash];
						ACTIVE.refreshUi();
					}, 1250);
				}, 1000);
			}
		}
	};

	/**
	 * Adds (if new), otherwise updates the state of a download item
	 */
	ACTIVE.ping = (item) => {
		const hash = ACTIVE.hash(item.id);

		if (!ACTIVE.running.hasOwnProperty(hash) && item.percentage === 0) {
			ACTIVE.running[hash] = {
				item, timeout: setTimeout(() => ACTIVE.remove(hash), 1E4)
			};

			if (!document.body.querySelector('div.ttdb_downloading-active')) {
				ACTIVE.create();
			}

			return ACTIVE.refreshUi();
		}

		clearTimeout(ACTIVE.running[hash].timeout);

		ACTIVE.running[hash].item.percentage = item.percentage;
		ACTIVE.refreshUi();
	};

	/**
	 * Create splash elements
	 */
	SPLASH.create = () => {
		const body = document.body;

		// Create splash elements
		const wrapper = document.createElement('div');
		const content = document.createElement('div');

		wrapper.classList.add('ttdb_splash-wrapper');
		content.classList.add('ttdb_splash-content');
		content.textContent = '';

		wrapper.appendChild(content);

		if (body) {
			body.appendChild(wrapper);

			// Store references
			SPLASH.wrapper = wrapper;
			SPLASH.content = content;

			SPLASH.content.addEventListener('click', (_) => {
				chrome.runtime.sendMessage(chrome.runtime.id, {
					task: 'fileShow'
				});
			});
		}

		return wrapper;
	};

	/**
	 * Display a splash message
	 * 
	 * @param {string}  message 
	 * @param {integer} duration 
	 */
	SPLASH.message = (message, options = {}, callback = null) => {
		const state = options.state ? options.state : 0;

		if (SPLASH.wrapper && SPLASH.content) {
			clearTimeout(TTDB.timers.splash);

			if (state === 0 || state === 1) {
				SPLASH.content.classList.remove('state-warn', 'state-error');
				SPLASH.content.classList.add('state-success');
			} else if (state === 2) {
				SPLASH.content.classList.remove('state-success', 'state-error');
				SPLASH.content.classList.add('state-warn');
			} else if (state === 3) {
				SPLASH.content.classList.remove('state-success', 'state-warn');
				SPLASH.content.classList.add('state-error');
			}

			SPLASH.content.textContent = message;

			DOM.setStyle(SPLASH.wrapper, {
				'opacity': 1,
				'pointer-events': 'auto'
			});

			TTDB.timers.splash = setTimeout(() => {
				DOM.setStyle(SPLASH.wrapper, {
					'opacity': 0,
					'pointer-events': 'none'
				});

				if (callback) {
					callback();
				}
			}, options.duration || 3000);

			return true;
		}
	};

	/**
	 * Different environments
	 * 
	 * Default: `APP` is the main environment (most regions)
	 * `__NEXT` has a different HTML structure, region-based and maybe obsolete now?
	 */
	TTDB.ENV = {
		APP: Symbol(true),
		__NEXT: Symbol(true),
	};

	TTDB.DEFAULT_ENV = TTDB.ENV.APP;

	/**
	 * `fetch` headers for requests
	 * 
	 * https://developer.mozilla.org/en-US/docs/Web/API/fetch
	 */
	TTDB.headers = {
		method: 'GET',
		mode: 'cors',
		cache: 'no-cache',
		credentials: 'include',
		redirect: 'follow'
	};

	/**
	 * API variables
	 */
	API.AID = 0;
	API.APP_NAME = 'musical_ly';
	API.HOSTNAME = 'api22-normal-c-useast2a.tiktokv.com';
	API.API_V = 'v1';

	API.FORMATS = [
		'play_addr',
		'play_addr_h264',
		'play_addr_bytevc1',
		'download_addr'
	];

	/**
	 * Builds an API query URL
	 * 
	 * @param {string} videoId 
	 */
	API.constructApiQuery = (videoId) => {
		const fetchType = 'feed';
		const ts = Math.round(Date.now() / 1000);

		const parameters = {
			'aweme_id': videoId,
			'version_name': '34.1.2',
			'version_code': '2023401020',
			'build_number': '34.1.2',
			'manifest_version_code': '2023401020',
			'update_version_code': '2023401020',
			'openudid': UTIL.ranGen('0123456789abcdef', 16),
			'uuid': UTIL.ranGen('0123456789', 16),
			'_rticket': ts * 1000,
			'ts': ts,
			'device_brand': 'Google',
			'device_type': 'ASUS_Z01QD',
			'device_platform': 'android',
			"iid": "7318518857994389254",
			"device_id": UTIL.ranInt(7250000000000000000, 7351147085025500000),
			'resolution': '1080*1920',
			'dpi': 420,
			'os_version': '10',
			'os_api': '29',
			'carrier_region': 'US',
			'sys_region': 'US',
			'region': 'US',
			'app_name': API.APP_NAME,
			'app_version': '34.1.2',
			'app_language': 'en',
			'manifest_app_version': '2023401020',
			'language': 'en',
			'timezone_name': 'America/New_York',
			'timezone_offset': '-14400',
			'channel': 'googleplay',
			'ac': 'wifi',
			'mcc_mnc': '310260',
			'is_my_cn': 0,
			'aid': API.AID,
			'ssmix': 'a',
			'as': 'a1qwert123',
			'cp': 'cbfhckdckkde1'
		};

		return `https://${API.HOSTNAME}/aweme/${API.API_V}/${fetchType}/` + Object.keys(parameters).map(
			(key, index) => `${index > 0 ? '&' : '?'}${key}=${parameters[key]}`
		).join('');
	};

	/**
	 * Attempts to get id from API data
	 * 
	 * @param {object} data 
	 */
	API.extractId = (data, fallback = null) => {
		const id = { user: null, description: null };

		/** Attempt to get the video description */
		if (UTIL.checkNested(data, 'aweme_detail', 'desc')) {
			id.description = data.aweme_detail.desc;
		}

		/** Attempt to get the channel of the video */
		(['unique_id', 'nickname', 'ins_id']).forEach((key) => {
			if (!id.user && UTIL.checkNested(data, 'aweme_detail', 'author', key)) {
				id.user = data.aweme_detail.author[key];
			}
		});

		if (!id.description) {
			return {
				user: id.user,
				description: fallback
					? fallback
					: (data.videoId ? data.videoId : Date.now())
			};
		}

		return id;
	};

	API.extractVideoUrls = (data) => {
		const urls = [];

		// Iterate over formats
		(API.FORMATS).forEach((format) => {
			// Check if format is available
			if (data.aweme_detail.video.hasOwnProperty(format) &&
				data.aweme_detail.video[format].hasOwnProperty('data_size') &&
				data.aweme_detail.video[format].hasOwnProperty('url_list') &&
				data.aweme_detail.video[format].url_list.length > 0) {
				const videoUrl = data.aweme_detail.video[format].url_list[0];
				const videoSize = data.aweme_detail.video[format].data_size;
				const videoRes = data.aweme_detail.video[format].height * data.aweme_detail.video[format].width;
				urls.push([videoRes, videoSize, videoUrl]);
			}
		});

		// Iterate over bit_rate data
		if (data.aweme_detail.video.hasOwnProperty('bit_rate') && Array.isArray(data.aweme_detail.video.bit_rate)) {
			let bestItem = null, bestQuality = null;

			for (const videoItem of data.aweme_detail.video.bit_rate) {
				if (bestQuality === null || videoItem.quality_type < bestQuality) {
					bestItem = videoItem;
					bestQuality = videoItem.quality_type;
				}
			}

			if (bestItem.hasOwnProperty('play_addr') && bestItem.play_addr.hasOwnProperty('url_list')) {
				const videoUrl = bestItem.play_addr.url_list[0];
				const videoSize = bestItem.play_addr.data_size;
				const videoRes = bestItem.play_addr.height * bestItem.play_addr.width;
				urls.unshift([videoRes, videoSize, videoUrl]);
			}
		}

		urls.sort((a, b) => (a[0] !== b[0]) ? b[0] - a[0] : b[1] - a[1]);

		return urls;
	}

	/**
	 * Attempts to get a response from the API
	 * 
	 * @param {string} videoId 
	 */
	API.getResponse = (videoId) => {
		let videoData = {
			success: false,
			description: null,
			user: null,
			url: null
		};

		return new Promise(async (resolve, reject) => {
			const urlQuery = API.constructApiQuery(videoId);

			try {
				const response = await chrome.runtime.sendMessage(
					chrome.runtime.id, { task: 'fetch', url: urlQuery }
				);

				const data = response.data; // Get JSON data

				if (response.error) {
					pipe('API Response failed', '@', urlQuery);
				} else if (data) {
					pipe('API Response:', data);
				}

				let videoUrl = null;

				// Extract potential fallback data if available
				if (data && UTIL.checkNested(data, 'aweme_list')) {
					const awemeList = data.aweme_list;
					const awemeEntries = Object.keys(awemeList);

					for (let index = 0; index < awemeEntries.length; index++) {
						const item = awemeList[awemeEntries[index]];
						const awemeId = item.aweme_id ? parseInt(item.aweme_id) : null;

						if (awemeId === parseInt(videoId)) {
							// Set list item as `aweme_detail` because the structure is the same as the default fetch method
							data.aweme_detail = { ...item }; break;
						}
					}
				}

				if (data && UTIL.checkNested(data, 'aweme_detail', 'video')) {
					const extractedUrls = API.extractVideoUrls(data);

					if (extractedUrls.length > 0) {
						pipe("Extracted URLs", extractedUrls);
						videoUrl = extractedUrls[0][2];
					} else {
						pipe("No URLs could be extracted from the response.");
					}
				}

				if (videoUrl) {
					videoData.success = true;
					videoData.url = videoUrl;

					videoData = {
						...videoData,
						...API.extractId({
							...data,
							...{
								videoId: videoId
							}
						}),
						apiFullResponse: data
					}; resolve(videoData);
				} else {
					reject('No `videoUrl` was found in the API response.');
				}
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Attempts to fetch video URL through the API
	 * 
	 * @param {string} videoId 
	 */
	API.getVideoData = async (videoId) => {
		return new Promise(async (resolve, reject) => {
			await API.getResponse(videoId).then((response) => {
				if (response.success) {
					resolve({
						...{
							success: false,
							description: null,
							user: null,
							url: null
						}, ...response
					})
				}
			}).catch((error) => {
				pipe('API Attempt failed:', error);
			});

			reject(null);
		});
	};

	/**
	 * Attempts to extract video data from the share popup
	 * 
	 * @param {HTMLElement} element 
	 */
	const findVideoUrls = (element) => {
		if (element) {
			/** Get shareable `a` elements */
			const anchors = element.querySelectorAll('a[href]');

			for (let i = 0; i < anchors.length; i++) {
				const matches = EXPR.vanillaVideoUrl(
					decodeURIComponent(anchors[i].getAttribute('href'))
				);

				/** If any matches */
				if (matches) {
					const [, username, videoId] = matches;
					return { username, videoId };
				}
			}
		}

		return false;
	}

	/**
	 * Attempts to get the `app` container
	 */
	const getAppContainer = () => {
		return document.querySelector(DOM.multiSelector({
			APP: 'div#app', __NEXT: 'div#main'
		}));
	};

	/**
	 * Attempts to fetch the web API data for a video
	 * 
	 * @param {object} videoData 
	 */
	const getWebApiData = (videoData) => {
		return new Promise((resolve, reject) => {
			if (!videoData.videoApiId) {
				reject('No video ID found in object');
			}

			const reqUrl = `https://www.tiktok.com/@${videoData.user}/video/${videoData.videoApiId}`;

			fetch(reqUrl).then((res) => res.text()).then((body) => {
				let status = null, webappDetail = null;

				const webDocument = (new DOMParser()).parseFromString(body, 'text/html');
				const UDScript = webDocument.querySelector('script#__UNIVERSAL_DATA_FOR_REHYDRATION__');

				if (UDScript) {
					try {
						const UD = JSON.parse(UDScript.innerText);
						status = UTIL.traverseObj(UD, ['webapp.video-detail', 'statusCode']) || 0
						webappDetail = UTIL.traverseObj(UD, ['webapp.video-detail', 'itemInfo', 'itemStruct']);
					} catch (error) {
						reject('Error parsing web data: ' + error);
					}
				}

				pipe('Got web API response', { status }, webappDetail);

				if (webappDetail && ![10216].includes(status)) { // Video data is OK
					resolve(webappDetail);
				} else if (status === 10216) { // Status indicates a private video
					reject('Video is private');
				}

				reject(`Video is not available (status code: ${status})`);
			}).catch((error) => {
				reject('Error fetching web data: ' + error);
			});
		});
	}

	/**
	 * Downloads a file
	 * 
	 * @param {string} url 
	 * @param {string} filename 
	 */
	const downloadFile = async (url, filename, buttonElement = null) => {
		// Sanitize filename
		filename = UTIL.sanitizeFilename(filename), hasFallbacked = false;

		if (filename.length > 250) { // Truncate any super long strings
			filename = UTIL.truncateString(filename, 250);
		}

		/**
		 * Reverts the state of the progress button
		 * 
		 * @param {HTMLElement} buttonElement 
		 */
		const revertState = (buttonElement) => {
			if (buttonElement) {
				buttonElement.classList.remove('loading');
			}
		}

		/**
		 * Fallback for when fetching is not allowed
		 */
		const fallback = async (url) => {
			if (hasFallbacked) return;
			pipe('✘ File could not be fetched — attempting to open instead.');

			SPLASH.message(
				'✘ Opened video in new tab (fetch was not allowed)', {
					duration: 3500, state: 2
				}
			);

			const tabActive = await getStoredSetting('download-fallback-tab-focus');

			chrome.runtime.sendMessage(
				chrome.runtime.id, {
					task: 'windowOpen', url, active: tabActive === null ? true : tabActive
				}
			);

			revertState(buttonElement);
			hasFallbacked = true;
		};

		let subFolder = await getStoredSetting('download-subfolder-path');
		if (!(typeof subFolder === 'string' || subFolder instanceof String)) {
			subFolder = '';
		}

		// Attempt download using chrome API (@ service.js)
		fetch(url, TTDB.headers).then(async (t) => {
			if (!UTIL.validateVideoRequest(t) || !t.body) { // Check if the content type is invalid
				pipe(`✘ Probe failed for ${url} (${t.headers.get('Content-Type') || ''} - ${t.status})`, t);
				return fallback(url);
			}

			pipe('✓ Probe is valid', t);

			// Create blob from response and send its URL to backend worker
			const chromium = UTIL.isChromium()
			const videoUrl = chromium ? URL.createObjectURL(await t.blob()) : url;
			const response = await chrome.runtime.sendMessage({
				task: 'fileDownload', url: videoUrl, filename, subFolder
			});

			if (response.success) {
				pipe(`✓ Downloaded ${url}`);
				SPLASH.message('✓ Downloaded video', { duration: 2500, state: 1 });
			} else {
				pipe(`✘ Downloading failed`, response);
				fallback(url);
			}

			// Reset download state and clear blob
			revertState(buttonElement);
			if (chromium) URL.revokeObjectURL(videoUrl);
		}).catch((error) => {
			pipe(error);
			fallback(url);
		});

	};

	/**
	 * DOM manipulation functions
	 */
	const DOM = {
		/**
		 * Creates a basic polygon svg element
		 * 
		 * @param {object} values 
		 */
		createPolygonSvg: (values) => {
			const w3Url = 'http://www.w3.org/2000/svg';
			const [width, height] = values.dimensions;

			const elementSvg = document.createElementNS(w3Url, 'svg');
			const elementPolygon = document.createElementNS(w3Url, 'polygon');

			DOM.setAttributes(elementSvg, {
				width, height,
				viewBox: `0 0 ${width} ${height}`
			});

			elementPolygon.setAttribute('points', values.points.join(' '));
			elementSvg.appendChild(elementPolygon);

			if (values.style) {
				DOM.setStyle(elementSvg, values.style);
			}

			return elementSvg;
		},
		/**
		 * Sets the CSS style of an element
		 * 
		 * @param {HTMLElement} element 
		 * @param {object}      values 
		 */
		setStyle: (element, values) => {
			Object.keys(values).forEach((key) => {
				element.style[key] = values[key];
			});
		},
		/**
		 * Sets the attributes of an element
		 * 
		 * @param {HTMLElement} element 
		 * @param {object}      attributes 
		 */
		setAttributes: (element, attributes) => {
			Object.keys(attributes).forEach((key) => {
				element.setAttribute(key, attributes[key]);
			});

			return element;
		},
		/**
		 * Creates a multi-selector out of an object
		 * 
		 * @param {object} values 
		 */
		multiSelector: (values) => {
			return Object.keys(values).map((key) => values[key]).join(', ');
		},
		selectorNamed: (values) => {
			for (const [name, value] of Object.entries(values)) {
				values[name] = document.querySelector(value) || null;
			}

			return values;
		},
		/**
		 * Base function for creating button elements
		 * 
		 * @param {object} values
		 */
		createButton: (values) => {
			const container = document.createElement('a');
			const inner = document.createElement(values.innerType ? values.innerType : 'span');

			if (values.content) {
				const [contentMode, content] = values.content || ['textContent', 'Download'];

				if (content instanceof Element) {
					inner[contentMode](content);
				} else {
					inner[contentMode] = content;
				}
			}

			container.appendChild(inner);
			container.setAttribute('class', values.class || '');

			return container;
		}
	};

	/**
	 * Creates different buttons for the different modes
	 */
	const createButton = {
		/** Basic player (theater view) */
		BASIC_PLAYER: () => {
			const wrapper = document.createElement('div');
			wrapper.classList.add('ttdb__button_basic-player_wrapper');

			/** Create download button */
			const button = DOM.createButton({
				content: ['textContent', 'Download'],
				class: 'ttdb__button_basic-player'
			});

			/** Set directly, as this makes it more compatible with dark mode addons */
			DOM.setStyle(button, {
				'border': '1px solid rgba(254, 44, 85, 1.0)',
				'background-color': 'rgba(254, 44, 85, 0.08)'
			});

			wrapper.appendChild(button);
			return wrapper;
		},
		/** Swiper slide items */
		SWIPER_SLIDE: () => {
			/** Create download button */
			const button = DOM.createButton({
				content: ['appendChild', DOM.createPolygonSvg({
					dimensions: [24, 24],
					points: [
						'13', '17.586', '13', '4', '11', '4',
						'11', '17.586', '4.707', '11.293', '3.293',
						'12.707', '12', '21.414', '20.707', '12.707',
						'19.293', '11.293', '13', '17.586'
					],
					style: {
						color: '#161823'
					},
				})],
				innerType: 'div',
				class: 'ttdb__button_swiper_slide'
			});

			/** Set directly, as this makes it more compatible with dark mode addons */
			DOM.setStyle(button, {
				'background-color': 'rgba(0, 0, 0, 0.25)',
				'color': '#000'
			});

			return button;
		},
		/** Browser items (full-view items) */
		BROWSER: () => {
			/** Create download button */
			return DOM.createButton({
				content: ['textContent', 'Download'],
				class: 'ttdb__button_browser'
			});
		},
		/** Feed items */
		FEED: () => {
			/** Create download button */
			return DOM.createButton({
				content: ['appendChild', DOM.createPolygonSvg({
					dimensions: [24, 24],
					points: [
						'13', '17.586', '13', '4', '11', '4',
						'11', '17.586', '4.707', '11.293', '3.293',
						'12.707', '12', '21.414', '20.707', '12.707',
						'19.293', '11.293', '13', '17.586'
					]
				})],
				innerType: 'div',
				class: 'ttdb__button_feed'
			});
		},
		/** Grid items (videos/liked items) */
		GRID: () => {
			/** Create download button */
			return DOM.createButton({
				content: false,
				class: 'ttdb__button_grid'
			});
		}
	};

	/**
	 * Attempts to extract the description/tags to use as an ID (for when no number ID is available)
	 * 
	 * @param {HTMLElement} container 
	 * @param {string}      env 
	 */
	const extractDescriptionId = (container, env = TTDB.ENV.APP) => {
		let identifier = null;
		let extracted = null;

		if (env === TTDB.ENV.APP) {
			const description = container.querySelector('span[class*="-SpanText "]');

			if (description) {
				extracted = description.parentElement.textContent;
			}
		} else if (env === TTDB.ENV.__NEXT) {
			const metaTitle = container.querySelector('div[class*="video-meta-caption"]');

			if (metaTitle) {
				extracted = metaTitle.textContent;
			}
		}

		if (extracted) {
			extracted = extracted.replace(/[/\\?%*:|"<>]/g, '-').toLowerCase().trim();

			if (extracted && extracted.length > 0) {
				identifier = extracted;
			}
		}

		return identifier;
	};

	/**
	 * Injects a button into the action bar of a feed item
	 * 
	 * Also monitors the parent for changes, as the action bar is prone to frequently
	 * updating and clearing its content, thus also the buttons.
	 * 
	 * @param {*} data 
	 */
	const feedInjectButton = (data) => {
		const { getActionBar, button, videoData } = data;

		const inject = () => {
			const actionBar = getActionBar();

			if (!actionBar.querySelector('a.' + [...button.classList].join('.'))) {
				button.setAttribute('video-id', videoData.id);

				downloadHook(button, videoData);
				button.ttIsProcessed = true;
				actionBar.prepend(button);

				setTimeout(() => {
					button.style.opacity = 1;
				}, 50);
			}
		};

		inject();

		let observer, timer = null;

		// Observe container for changes
		observer = new MutationObserver(() => {
			// (Re-)inject to new action bar if needed
			inject(); clearTimeout(timer);

			// Disconnects observer after an idle time
			timer = setTimeout(() => observer.disconnect(), 1E5);
		});

		// Start observing action bar container for changes
		observer.observe(getActionBar().parentNode, {
			childList: true, subtree: true
		});
	}

	/**
	 * Gets the action bar of a feed item
	 * @param {HTMLElement} element 
	 */
	const feedGetActionBar = (item, data) => {
		return item.querySelector(data.env === TTDB.ENV.APP ?
			'section[class*="-SectionActionBarContainer"]' :
			'div[class*="-action-bar"].vertical'
		);
	}

	/**
	 * Extracts the video ID from a feed element
	 * @param {HTMLElement} element 
	 */
	const feedExtractVideoId = (element) => {
		const xgWrapper = element.querySelector('div.xgplayer-container');

		if (!xgWrapper || !xgWrapper.hasAttribute('id')) {
			return false;
		}

		const [, , videoId] = xgWrapper.getAttribute('id').split('-');

		return videoId || false;
	};

	/**
	 * Hacky way of retrieving the videoId of a `For You` item
	 * 
	 * We need the ID to query the API correctly.
	 * 
	 * @param {HTMLElement} element 
	 * @param {function}    callback 
	 * @param {integer}     timeout
	 */
	const feedShareExtractIdLegacy = (element, callback, timeout = 500) => {
		let timer = null;

		const shareButton = element.querySelector('div[role="button"][data-e2e="share-btn"] > button:not(.attempted)');
		const shareButtonSvg = shareButton.querySelector('span > svg');

		// None of the required elements are defined — return `false`
		if (!shareButtonSvg || !shareButton) {
			callback(false);
		}

		// Callback wrapper
		const respond = (response, existing = false) => {
			if (!existing) {
				setTimeout(() => shareButton.classList.remove('extract'), 500);
				clearTimeout(timer);
				UTIL.dispatchEvent(shareButtonSvg, MouseEvent, 'click');
			} callback(response);
		};

		/**
		 * Called on mutation
		 * 
		 * @param {array} mutationsList 
		 */
		const onMutate = (mutationsList) => {
			for (let mutation of mutationsList) {
				if (mutation.type === 'childList') {
					const attempt = findVideoUrls(element.querySelector('div[class*="-DivContainer "]'));

					if (attempt) {
						observer.disconnect(); // Good attempt — disconnect observer	
						respond(attempt); break;
					}
				}
			}
		};

		// Checks if a share menu already is present
		let existingShare = element.querySelector('div[class*="-DivContainer "]');

		// Share menu is present, clone it and extract data
		if (existingShare) {
			attempt = findVideoUrls(existingShare.cloneNode(true));

			if (attempt) {
				respond(attempt, true); // Good attempt, callback
			} else {
				existingShare = false; // Failed attempt
			}
		}

		/**
		 * If no existing share menu (this accounts for 99% of the cases)
		 * 
		 * It only really already exists if the user hovers the share button prior
		 * to the actual extraction, which is rare.
		 */
		if (!existingShare) {
			observer = new MutationObserver(onMutate);
			observer.observe(shareButton, { childList: true, subtree: true });

			// Add a temporary class to hide `Share` menu
			shareButton.classList.add('extract');

			// Simulate a click on the share button's `SVG`
			UTIL.dispatchEvent(shareButtonSvg, MouseEvent, 'click');

			timer = setTimeout(() => { // If no success within `timeout`, return `false`
				observer.disconnect();
				respond(false);
			}, timeout);
		}

		return false;
	};

	const itemData = { extract: {} };

	/** Feed items (`For Your` page etc.) */
	itemData.extract[TTDB.MODE.FEED] = (data) => {
		const videoData = {};

		let itemUser = data.container.querySelector(DOM.multiSelector({
			app: 'a > [class*="AuthorTitle "]',
			__next: 'h3.author-uniqueId'
		}));

		if (itemUser) {
			/** Set username */
			videoData.user = itemUser.textContent;
		} else {
			/** Fallback username fetch */
			itemUser = data.container.querySelector('a[href^="/@"]');

			if (itemUser) {
				videoData.user = itemUser.getAttribute('href').split('/@')[1];
				if (videoData.user.includes('?')) {
					videoData.user = videoData.user.split('?')[0];
				}
			}
		}

		// Get alternative id (no ID available here)
		const descriptionIdentifier = extractDescriptionId(data.container, data.env);

		// Set `descriptionIdentifier` or fallback
		videoData.id = descriptionIdentifier ? descriptionIdentifier : Date.now();

		return videoData;
	};

	/** Grid items (videos from user page, liked videos etc.) */
	itemData.extract[TTDB.MODE.GRID] = (data) => {
		const videoData = {};
		const itemLinks = data.container.querySelectorAll('a[href*="com/@"]');

		(itemLinks).forEach((link) => {
			const matches = EXPR.vanillaVideoUrl(link.getAttribute('href'), {
				strict: true
			});

			if (matches) {
				let [, user, id] = matches;

				videoData.user = user;
				videoData.id = id;

				if (/^\d+$/.test(id)) {
					videoData.videoApiId = id;
				}
			}
		});

		return videoData;
	};

	/** Browser items (when opening a video grid item or on the `For You` page) */
	itemData.extract[TTDB.MODE.BROWSER] = (data) => {
		const videoData = {};

		let itemUser = null;

		if (data.env === TTDB.ENV.APP) {
			/** Get username */
			itemUser = data.container.querySelector('div[class*="-DivInfoContainer "] a[href*="/@"]');

			if (itemUser) {
				videoData.user = itemUser.getAttribute('href').split('/@')[1];
				if (videoData.user.includes('?')) {
					videoData.user = videoData.user.split('?')[0];
				}
			}

			const selectors = DOM.selectorNamed({
				xgWrapper: 'div[id*="xgwrapper-"]',
				spanUniqueId: 'span[class*="-SpanUniqueId"]',
				legacyCopyLink: 'p[class*="-PCopyLinkText"]',
			});

			// Attempt `xgwrapper` extraction
			if (selectors.xgWrapper) {
				const xgId = selectors.xgWrapper.getAttribute('id').split('-').pop();

				if (parseInt(xgId) > 0) {
					videoData.videoApiId = xgId;

					if (selectors.spanUniqueId) {
						videoData.user = selectors.spanUniqueId.innerText.trim();
					}

					pipe('[BROWSER] Extracted from `xgwrapper`:', videoData);
				}
			}

			// Attempt location extraction
			if (!videoData.videoApiId) {
				const matches = EXPR.vanillaVideoUrl(window.location.href);

				if (matches) {
					const [, user, videoId] = matches;

					videoData.videoApiId = videoId;
					videoData.user = user;

					pipe('[BROWSER] Extracted from window location:', videoData);
				}
			}

			// Attempt "Copy link" extraction
			if (!videoData.videoApiId && selectors.legacyCopyLink) {
				// Get data from copy link URL
				const matches = EXPR.vanillaVideoUrl(selectors.legacyCopyLink.textContent);
				const [, username, videoId] = matches;

				videoData.user = username;
				videoData.videoApiId = videoId;

				pipe('[BROWSER] Extracted from copy link feature:', videoData);
			}

			// Attempt anchor extraction
			if (!videoData.videoApiId) {
				// Get data from share URLs
				const shareData = findVideoUrls(data.container);

				if (shareData) {
					videoData.user = shareData.username;
					videoData.videoApiId = shareData.videoId;

					pipe('[BROWSER] Extracted from share URLs:', videoData);
				}
			}
		} else if (data.env === TTDB.ENV.__NEXT) {
			// Extract username
			itemUser = data.container.querySelector('div.user-info a > h2.user-username');

			if (itemUser) {
				videoData.user = itemUser.textContent.trim();
			}
		}

		// Get alternative id (no ID available here)
		const descriptionIdentifier = extractDescriptionId(data.container, data.env);

		if (descriptionIdentifier) {
			videoData.id = descriptionIdentifier;
		}

		return videoData;
	};

	itemData.extract[TTDB.MODE.BASIC_PLAYER] = (data) => {
		const videoData = {};
		const parent = data.container.closest('div[class*="-DivLeftContainer "]');

		if (parent) {
			const userId = parent.querySelectorAll(
				'span[class*="-SpanUniqueId "], span[data-e2e="browse-username"]'
			);

			if (userId[0]) {
				videoData.user = userId[0].textContent.trim();
			} else {
				// User ID fallback
				const authorElement = parent.querySelector('div[class*="-DivAuthorContainer "]');

				if (authorElement) {
					const userHref = authorElement.querySelectorAll('a[href^="/@"]');

					if (userHref[0]) {
						videoData.user = userHref[0].getAttribute('href').split('/@')[1].trim();
						if (videoData.user.includes('?')) {
							videoData.user = videoData.user.split('?')[0];
						}
					} else {
						videoData.user = 'tiktok_video';
					}
				}
			}

			let videoTags = parent.querySelectorAll(
				'span[class*="-SpanText "], a[href^="/tag/"] \
				strong[class*="-StrongText "]'
			);

			if (videoTags) {
				videoTags = [...videoTags].map((e) => {
					return e.textContent ? e.textContent.trim() : false;
				});

				videoTags = videoTags.filter((e) => e);
				videoData.id = videoTags.join(' ');
			}
		}

		// Get user and video id from URL
		const matches = EXPR.vanillaVideoUrl(window.location.href);

		if (matches) {
			const [, user, videoId] = matches;

			videoData.videoApiId = videoId;
			videoData.user = user;
		}

		return videoData;
	};

	/**
	* Get video data from an item
	* 
	* @param {HTMLElement} container 
	* @param {object}      data 
	*/
	itemData.get = (container, data) => {
		let videoData = { id: null, user: null, url: null };
		const videoElement = container.querySelector('video');

		if (videoElement && itemData.extract[data.mode]) {
			// Get actual video download URL (as it's played in the browser)
			videoData.url = videoElement.getAttribute('src');

			if (!videoData.url) { // If we have a <source/> element instead of an attribute
				const sourceElement = videoElement.querySelector('source');

				if (sourceElement) {
					videoData.url = sourceElement.getAttribute('src');
				}
			}

			videoData = {
				...videoData,
				...itemData.extract[data.mode](data)
			};

			if (!videoData.id) {
				videoData.id = Date.now();
			}
		}

		return videoData;
	};

	/**
	* Fetches video items
	*/
	const selectAllVideoItems = () => {
		const selectors = DOM.multiSelector({
			appShareOverlay: 'div.TUXModal > div[data-e2e="share-group"]:not([is-downloadable])',
			appItemContainer: 'div[class*="-DivItemContainer"]:not([is-downloadable]):not([class*="-kdocy-"])',
			appBrowserMode: 'div[class*="-DivBrowserModeContainer "]:not([is-downloadable])',
			// appSwiperSlide: 'div.swiper div.swiper-slide:not([is-downloadable])',
			appBasicPlayer: 'div[class*="-DivLeftContainer "] div[class*="-DivVideoContainer "] \
				div[class*="-DivContainer "]:not([is-downloadable])',
			// appFeedArticle: 'article[class*="-ArticleItemContainer"]:not([is-downloadable])',
			__nextGrid: 'div.video-feed div.video-feed-item:not([is-downloadable])',
			__nextBig: 'div.video-feed-container div.feed-item-content:not([is-downloadable])',
			__nextBrowser: 'div.tt-feed div.video-card-big.browse-mode:not([is-downloadable])'
		});

		return document.querySelectorAll(selectors);
	};

	/**
	 * Object getter using dot notation
	 */
	const _get = (obj, path, defValue) => {
		if (!path) {
			return undefined;
		}

		const pathArray = Array.isArray(path) ? path : path.match(/([^[.\]])+/g);
		const result = pathArray.reduce(
			(prevObj, key) => prevObj && prevObj[key],
			obj
		);

		return result === undefined ? defValue : result
	}

	/**
	 * Returns the filename template
	 * 
	 * @param {object} data 
	 * @param {string} template 
	 */
	const getFileNameTemplate = (data, apiData, template = '{uploader} - {desc}') => {
		const templateValues = {};

		// Desired template data of the keys
		const templateKeys = {
			// User ID (their @ID)
			uploader: [['author', 'uniqueId'], data.user, ['aweme_detail', 'author', 'unique_id']],
			// User nickname (full username), not their @ID
			nickname: [['author', 'nickname'], ['aweme_detail', 'author', 'nickname']],
			// Video description
			desc: [['desc'], data.description, ['aweme_detail', 'author', 'unique_id']],
			// User ID
			uid: [['author', 'id'], ['aweme_detail', 'author', 'uid'], ['aweme_detail', 'author_user_id']],
			// Video ID
			id: [['id'], data.videoApiId, data.videoId],
			// Video region
			region: [['aweme_detail', 'region']],
			// Video language
			language: [['aweme_detail', 'author', 'language']],
			// Uploaders signature (their profile description essentially)
			signature: [['author', 'signature'], ['aweme_detail', 'author', 'signature']],
			// Upload timestamp (Unix)
			uploaded: [['createTime'], ['aweme_detail', 'create_time']],
			// Current timestamp (Unix)
			timestamp: [Math.round(Date.now() / 1000)]
		};

		// Get template options from the API data
		for (const [key, value] of Object.entries(templateKeys)) {
			if (!templateValues.hasOwnProperty(key)) {
				let keyData = null; for (const item of value) {
					if (!Array.isArray(item) && item) {
						keyData = item; break;
					} else if (Array.isArray(item) && UTIL.checkNested(apiData, ...item)) {
						keyData = _get(apiData, item.join('.')); break;
					}
				}

				// Set template key value, revert to a nulled string
				templateValues[key] = keyData || '';
			}
		}

		// Create readable timestamps
		for (const timestamp of ['uploaded', 'timestamp']) {
			// Make sure it's an integer
			templateValues[timestamp] = parseInt(templateValues[timestamp]);

			if (Number.isInteger(templateValues[timestamp]) && templateValues[timestamp] > 0) {
				const ts = new Date(templateValues[timestamp] * 1000);
				const tsData = {
					year: ts.getFullYear(),
					month: ts.getMonth() + 1,
					day: ts.getDate(),
					hour: ts.getHours(),
					minute: ts.getMinutes(),
					second: ts.getSeconds()
				};

				for (const [key, value] of Object.entries(tsData)) { // Pad any values under ten
					if (value < 10) tsData[key] = `0${value}`;
				}

				const tsDate = `${tsData.year}${tsData.month}${tsData.day}`; // Format date
				const tsTime = `${tsData.hour}${tsData.minute}${tsData.second}`; // Format time

				// Set template key value
				templateValues[`${timestamp}_s`] = `${tsDate}_${tsTime}`;
			}
		}

		pipe('Template values', templateValues);

		let filename = template;

		// Replace template options with actual values
		for (const [key, value] of Object.entries(templateValues)) {
			filename = filename.replace(`{${key}}`, value);
		}

		// Remove any remaining template options
		filename = filename.replace(/({[^}]+})/g, '');

		if (!filename.endsWith('.mp4')) {
			filename = `${filename}.mp4`;
		}

		return filename.length >= 5 ? filename : null;
	};

	const downloadHook = async (button, videoData) => {
		const videoIdentifier = videoData.id ? videoData.id : Date.now();
		let fileName = `${videoData.user ? videoData.user + ' - ' : ''}${videoIdentifier}`;

		DOM.setAttributes(button, {
			filename: `${fileName.trim()}.mp4`
		});

		if (videoData.videoApiId) {
			button.setAttribute('video-id', videoData.videoApiId);
		}

		if (!button.hasListener) {
			button.addEventListener('click', async (e) => {
				e.preventDefault();

				if (button.classList.contains('loading')) {
					return false; // Download is already in progress
				} else {
					button.classList.add('loading'); // Set loading state
				}

				const attrFilename = button.getAttribute('filename') || null;
				const attrApiId    = button.getAttribute('video-id') || null;
				const attrUrl      = button.getAttribute('href')     || null;

				let nameTemplate = await getStoredSetting('download-naming-template');

				if (!(typeof nameTemplate === 'string' || nameTemplate instanceof String) || nameTemplate.length < 1) {
					nameTemplate = false;
				} else {
					nameTemplate = nameTemplate.trim();
				}

				const usageData = {
					videoUrl: attrUrl,
					filename: attrFilename
				};

				await getWebApiData({
					...videoData, ...{
						videoApiId: attrApiId
					}
				}).then(async (webData) => {
					if (webData.video && webData.video.playAddr) {
						usageData.videoUrl = webData.video.playAddr;

						if (nameTemplate) {
							usageData.filename = getFileNameTemplate(videoData, webData, nameTemplate);
						} pipe('Web API data was found:', { response: webData });
					}
				}).catch(async (error) => {
					pipe(`Failed to get web API data (${error}) - trying mobile API instead.`);

					await API.getVideoData(attrApiId).then(async (res) => {
						const templated = getFileNameTemplate(
							{ ...res, ...{ videoId: attrApiId } }, res.apiFullResponse, nameTemplate
						);

						if (res.url) {
							usageData.videoUrl = res.url;
							usageData.filename = templated ? templated : (
								`${res.user ? (res.user + ' - ') : ''}${res.description.trim()}.mp4`
							); pipe('Mobile API data was found.', res);
						}
					}).catch((_) => {
						pipe('Failed to get API data.');
					});
				}).finally((_) => {
					if (!usageData.filename) {
						usageData.filename = attrFilename;
					}
				});

				if (!usageData.videoUrl) {
					SPLASH.message('✘ No video URL was found for download.', {
						duration: 5000, state: 3
					}); return;
				}

				pipe('Attempting to download using data: ', usageData);
				downloadFile(usageData.videoUrl, usageData.filename, button);
			});

			button.hasListener = true;
		}

		/** Download data has been set, make element interactable again */
		DOM.setStyle(button, {
			'cursor': 'pointer',
			'pointer-events': 'auto'
		});

		return button;
	};

	const itemSetup = { setters: {} };

	itemSetup.setters[TTDB.MODE.BROWSER] = (item, data) => {
		let linkContainer = null;

		if (data.env === TTDB.ENV.APP) {
			linkContainer = document.querySelector(DOM.multiSelector({
				legacyCopyLink: 'div[class*="-DivCopyLinkContainer"]',
				newMainContent: 'div[class*="-DivTabMenuContainer"]'
			}));
		} else if (data.env === TTDB.ENV.__NEXT) {
			linkContainer = item.querySelector('div.video-infos-container > div.action-container');
		}

		if (linkContainer) {
			// Mark container as handled (download hook as been set up)
			item.setAttribute('is-downloadable', 'true');

			// Create download button
			const button = createButton.BROWSER();
			const videoData = itemData.get(item, data);

			if (data.env === TTDB.ENV.APP) {
				linkContainer.before(button);
			} else if (data.env === TTDB.ENV.__NEXT) {
				linkContainer.after(button);
			}

			button.setAttribute('ttdb_mode', data.env === TTDB.ENV.__NEXT ? '__NEXT' : 'APP');

			downloadHook(button, videoData);

			if (TTDB.observers.browserObserver) {
				TTDB.observers.browserObserver.disconnect();
			}

			const callback = (mutationsList) => {
				for (const mutation of mutationsList) {
					if (mutation.type === 'childList') {
						clearTimeout(TTDB.timers.browserObserver);
						TTDB.timers.browserObserver = setTimeout(() => {
							downloadHook(button, itemData.get(item, data));
						}, 100);
					}
				}
			};

			TTDB.observers.browserObserver = new MutationObserver(callback);

			// Observe any changes when navigating through items
			TTDB.observers.browserObserver.observe(item, {
				childList: true,
				subtree: true
			});

			return true;
		}

		return false;
	};

	itemSetup.setters[TTDB.MODE.GRID] = (item, data) => {
		item.setAttribute('is-downloadable', 'true');

		// Create download button
		const button = createButton.GRID();

		const setButton = (videoData, button) => {
			pipe('Found video data:', videoData);

			// Valid video URL — set download data
			if (videoData.url && !button.ttIsProcessed) {
				downloadHook(button, videoData);
				button.ttIsProcessed = true;
			}
		}

		item.addEventListener('mouseleave', () => {
			// Clear any active timers on `mouseleave`
			clearInterval(TTDB.timers.gridAwaitVideoData);
		});

		item.addEventListener('mouseenter', () => {
			if (!button.ttIsProcessed) {
				clearInterval(TTDB.timers.gridAwaitVideoData);

				let videoData = itemData.get(item, data);

				// No URL was found on the initial attempt
				if (!videoData.url) {
					// Check for existing video URLs
					TTDB.timers.gridAwaitVideoData = setInterval(() => {
						videoData = itemData.get(item, data);

						// We have a valid video URL — set download data and clear interval
						if (videoData.url) {
							setButton(videoData, button);
							clearInterval(TTDB.timers.gridAwaitVideoData);
						}
					}, 100);
				} else {
					// We have a valid video URL — set download data
					setButton(videoData, button);
					button.ttIsProcessed = true;
				}
			}
		});

		DOM.setStyle(item, { 'position': 'relative' });
		item.appendChild(button);
		setTimeout(() => { button.style.opacity = 1; }, 100);

		return true;
	};

	itemSetup.setters[TTDB.MODE.FEED] = (item, data) => {
		const videoPreview = item.querySelector(data.env === TTDB.ENV.APP ?
			':scope > div:first-child' :
			'div[class*="video-card"] > span[class$="mask"]'
		);

		if (videoPreview) {
			if (!feedGetActionBar(item, data)) {
				return;
			}

			const videoData = itemData.get(item, data);
			const button = createButton.FEED();

			if (videoData.url && !button.ttIsProcessed) {
				videoData.id = feedExtractVideoId(item);

				if (videoData.id) {
					feedInjectButton({
						getActionBar: () => {
							return feedGetActionBar(item, data);
						},
						button: button,
						videoData: videoData
					});

					item.setAttribute('is-downloadable', 'true');
				}
			}

			return true;
		}

		return false;
	};

	/** Set up swiper slide item (may be obsolete) */
	itemSetup.setters[TTDB.MODE.SWIPER_SLIDE] = (item, data) => {
		const videoPreview = item.querySelector('img');
		const videoWrapper = item.querySelector('div[class*="VideoWrapperForSwiper"]');

		let videoElement = item.querySelector('video');

		if ((videoElement || videoPreview) && videoWrapper) {
			item.setAttribute('is-downloadable', 'true');

			// Create download button
			const button = createButton.SWIPER_SLIDE();
			videoWrapper.prepend(button);

			// We already have a valid video element
			if (videoElement) {
				const videoData = itemData.get(item, data);

				// We have a valid video URL, so set download data
				if (videoData.url && !button.ttIsProcessed) {
					setTimeout(() => button.style.opacity = 1, 50);
					downloadHook(button, videoData);
					button.ttIsProcessed = true;
				} else {
					videoElement = null;
				}
			}

			// Only preview, no video has loaded yet
			if (videoPreview && !videoElement) {
				// Item has not loaded, so we'll prepare and watch for it
				const container = videoWrapper;
				const observer = new MutationObserver((mutationsList, observer) => {
					for (const mutation of mutationsList) {
						if (mutation.type === 'childList') {
							const videoData = itemData.get(item, data);

							// We have a valid video URL, so set download data
							if (videoData.url && !button.ttIsProcessed) {
								observer.disconnect();
								setTimeout(() => button.style.opacity = 1, 50);
								downloadHook(button, videoData);
								button.ttIsProcessed = true;
							}
						}
					}
				});

				observer.observe(container, { childList: true, subtree: true });
			}

			return true;
		}

		return false;
	};

	/** Set up basic player item ("theater" mode) */
	itemSetup.setters[TTDB.MODE.BASIC_PLAYER] = (item, data) => {
		let videoElement = item.querySelector('video');

		if (videoElement) {
			item.setAttribute('is-downloadable', 'true');

			// Create download button
			let button = createButton.BASIC_PLAYER();
			let parent = data.container.closest('div[class*="-DivLeftContainer "]');

			if (parent) {
				let existingButton = parent.querySelector(`.${button.classList[0]}`);

				if (existingButton) {
					existingButton.remove();
				}

				parent.children[0].parentNode.insertBefore(
					button, parent.children[0].nextSibling
				);

				button = button.querySelector('a');

				const widthTarget = parent.querySelector('div[class*="-DivInfoContainer "]');
				DOM.setStyle(button, { 'width': `${widthTarget ? widthTarget.offsetWidth : 320}px` });

				// We already have a video element
				if (videoElement) {
					const videoData = itemData.get(item, data);

					// We have a valid video URL, so set download data
					if (videoData.url && !button.ttIsProcessed) {
						button.parentNode.style.display = 'inherit';
						setTimeout(() => button.style.opacity = '1', 50);
						downloadHook(button, videoData);
						button.ttIsProcessed = true;
					} else {
						videoElement = null;
					}
				}
			}
		}
	};

	itemSetup.setters[TTDB.MODE.SHARE_OVERLAY] = (item, _) => {
		const input = item.querySelector('input[value*="/video/"]');
		item.setAttribute('is-downloadable', 'true');

		if (!input) {
			return;
		}

		const matches = EXPR.vanillaVideoUrl(input.getAttribute('value'));

		if (matches) {
			const [, username, videoId] = matches;
			const button = createButton.BASIC_PLAYER();

			item.prepend(button);

			button.classList.add('share');
			button = button.querySelector('a');
			button.parentNode.style.display = 'block';

			setTimeout(() => button.style.opacity = '1', 50);

			downloadHook(button, {
				id: videoId,
				videoApiId: videoId,
				user: username,
				url: ''
			});
		}
	};

	/**
	* Set up item (get data, create download button and hooks)
	* 
	* @param {string}      itemType 
	* @param {HTMLElement} item 
	* @param {object}      data 
	*/
	itemSetup.set = (itemType, item, data) => {
		return itemSetup.setters[itemType](item, data);
	};

	// Updates video items
	const updateItems = () => {
		let processed = 0;

		(selectAllVideoItems()).forEach((item) => {
			let currentMode = null;
			let currentEnvironment = null;

			const modeElement = item.querySelector('div[mode]');

			if (modeElement) {
				currentMode = modeElement.getAttribute('mode');
				currentEnvironment = TTDB.ENV.APP;
			} else {
				const classList = item.classList;

				if (classList.contains('video-feed-item') || classList.contains('three-column-item')) {
					currentMode = TTDB.MODE.GRID;
				} else if (classList.contains('feed-item-content')) {
					currentMode = TTDB.MODE.FEED;
				} else if (classList.contains('browse-mode') || classList.contains('video-card-big')) {
					currentMode = TTDB.MODE.BROWSER;
				} else if (classList.contains('swiper-slide')) {
					currentMode = TTDB.MODE.SWIPER_SLIDE;
				} else if (item.querySelector('div.tiktok-web-player > video')) {
					currentMode = TTDB.MODE.BASIC_PLAYER;
				} else if (item.querySelector('input[value*="/video/"]')) {
					currentMode = TTDB.MODE.SHARE_OVERLAY;
				}

				if (currentMode !== null) {
					currentEnvironment = TTDB.ENV.__NEXT;
				}
			}

			if (currentMode) {
				// Set default environment if nothing has been detected
				if (currentEnvironment === null) {
					currentEnvironment = TTDB.DEFAULT_ENV;
				}

				// Data that we're sending downstream
				if (itemSetup.set(currentMode, item, {
					mode: currentMode,
					env: currentEnvironment,
					container: item
				})) {
					processed++;
				}
			}
		});

		return processed;
	};

	// Adds download buttons to video elements
	const updatePage = () => {
		const processedItems = updateItems();

		if (processedItems > 0) {
			pipe(`Processed ${processedItems} item${processedItems !== 1 ? 's' : ''}!`);
		}
	};

	// Check for updates on `scroll`
	document.addEventListener('scroll', () => {
		clearTimeout(TTDB.timers.scrollBreak);
		TTDB.timers.scrollBreak = setTimeout(() => TTDB.setInterval(20), 250);
	});

	// Check for updates on `click`
	window.addEventListener('click', () => TTDB.setInterval(10));

	const debounce = (f, ms) => {
		let timeout;

		return (...args) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => f.apply(this, args), ms);
		};
	};

	const observeApp = (container) => {
		if (TTDB.observers.main) {
			TTDB.observers.main.disconnect();
		}

		const debouncedCallback = debounce((mutationsList) => {
			for (let mutation of mutationsList) {
				if (mutation.type === 'childList') {
					TTDB.setInterval(15); break;
				}
			}
		}, 2000);

		TTDB.observers.main = new MutationObserver(debouncedCallback);

		TTDB.observers.main.observe(container, {
			childList: true,
			subtree: true
		});

		pipe('Watching for DOM changes ...');
	};

	let appContainer = getAppContainer();

	if (appContainer) {
		observeApp(appContainer);
	} else {
		let checks = 0;

		TTDB.timers.appCreationWatcher = setInterval(() => {
			appContainer = getAppContainer();

			if (appContainer || checks === 10) {
				clearInterval(TTDB.timers.appCreationWatcher);

				if (appContainer) {
					observeApp(appContainer);
				}
			} checks++;
		}, 1000);
	}

	// Tracks and does item checks on the page
	setInterval(() => {
		if (TTDB.interval.counter > 0) {
			updatePage(); TTDB.interval.counter--;
		}
	}, TTDB.interval.delay);

	// Create splash elements
	SPLASH.create();
})();