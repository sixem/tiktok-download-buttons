(async () =>
{
	const TTDB = {}, API = {}, EXPR = {}, UTIL = {}, SPLASH = {};

	TTDB.timers = {};
	TTDB.observers = {};
	
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
		BASIC_PLAYER: '4'
	};
	
	/**
	 * Sets the amount of item checks to do
	 * 
	 * @param {integer} count 
	 */
	TTDB.setInterval = (count) =>
	{
		if(TTDB.interval.counter < count)
		{
			TTDB.interval.counter = count
		}
	};
	
	/**
	 * Log to console
	 * 
	 * @param  {...any} args 
	 */
	const pipe = (...args) =>
	{
		console.log('[TTDB]', ...args)
	};
	
	/**
	 * Dipatches an event on an element
	 * 
	 * @param {HTMLElement} element 
	 * @param {class}       eventType 
	 * @param {string}      event 
	 */
	UTIL.dispatchEvent = (element, eventType, event) =>
	{
		element.dispatchEvent(new eventType(event,
		{
			bubbles: true,
			cancelable: true,
			view: window
		}));
	};

	/**
	 * Truncates a string
	 * 
	 * @param {string}  string 
	 * @param {integer} n 
	 */
	UTIL.truncateString = (string, n) =>
	{
		return (string.length > n) ? string.substr(0, n - 1) : string;
	};
	
	/**
	 * Generates a random string from a character set
	 * 
	 * @param {string}  characters 
	 * @param {integer} length 
	 */
	UTIL.ranGen = (charSet, length = 16) =>
	{
		let result = '';
		let setLength = charSet.length;
	
		for(let i = 0; i < length; i++)
		{
			result += charSet.charAt(Math.floor(Math.random() *  setLength));
		}
	
		return result;
	};
	
	/**
	 * Attempts to sanitize a filename
	 * 
	 * @param {string} string 
	 */
	UTIL.sanitizeFilename = (string) =>
	{
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

		/** Remove any leading dots */
		while(string[0] === '.')
		{
			string = string.substring(1);
		}

		/** Filename limit is about 250, so we'll shorten any super long filenames. */
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
	UTIL.checkNested = (obj, level, ...rest) =>
	{
		if(obj === undefined)
		{
			return false;
		}
	
		if(rest.length == 0 && obj.hasOwnProperty(level))
		{
			return true;
		}
	
		return UTIL.checkNested(obj[level], ...rest);
	};
	
	/**
	 * Fetches a stored setting
	 * 
	 * @param {string} key 
	 */
	const getStoredSetting = async (key) =>
	{
		let stored = await chrome.storage.local.get(key);
	
		if(stored && stored.hasOwnProperty(key))
		{
			return stored[key];
		}
	
		return null;
	};
	
	/** Matches `https://www.tiktok.com/@user/video/123456789` URLs */
	EXPR.vanillaVideoUrl = (haystack, options = {}) =>
	{
		let expression = ('https?:\/\/(?:www\.)?tiktok\.com\/@([^\/]+)\/video\/([0-9]+)');
	
		if(options.strict)
		{
			expression = ('^' + expression + '$');
		}
	
		let matches = new RegExp(expression).exec(haystack);
	
		return matches ? matches : null;
	};
	
	/**
	 * Create splash elements
	 */
	SPLASH.create = () =>
	{
		let body = document.body;
	
		/** Create splash elements */
		let wrapper = document.createElement('div');
		let content = document.createElement('div');
	
		/** Add classes */
		wrapper.classList.add('ttdb_splash-wrapper');
		content.classList.add('ttdb_splash-content');
	
		content.textContent = '';
	
		/** Wrap the content */
		wrapper.appendChild(content);
	
		if(body)
		{
			/** Append splash content to body */
			body.appendChild(wrapper);
	
			/** Store references */
			SPLASH.wrapper = wrapper;
			SPLASH.content = content;
	
			/** Click listener */
			SPLASH.content.addEventListener('click', (e) =>
			{
				chrome.runtime.sendMessage(chrome.runtime.id,
				{
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
	SPLASH.message = (message, options = {}, callback = null) =>
	{
		let state = options.state ? options.state : 0;
	
		if(SPLASH.wrapper && SPLASH.content)
		{
			clearTimeout(TTDB.timers.splash);
	
			if(state === 0 || state === 1)
			{
				if(SPLASH.content.classList.contains('state-warn'))
					SPLASH.content.classList.remove('state-warn');
	
				if(!SPLASH.content.classList.contains('state-success'))
					SPLASH.content.classList.add('state-success');
			} else if(state > 1)
			{
				if(SPLASH.content.classList.contains('state-success'))
					SPLASH.content.classList.remove('state-success');
	
				if(!SPLASH.content.classList.contains('state-warn'))
					SPLASH.content.classList.add('state-warn');
			}
	
			SPLASH.content.textContent = message;

			DOM.setStyle(SPLASH.wrapper, {
				'opacity': 1,
				'pointer-events': 'auto'
			});
	
			TTDB.timers.splash = setTimeout(() =>
			{
				DOM.setStyle(SPLASH.wrapper, {
					'opacity': 0,
					'pointer-events': 'none'
				});
	
				if(callback)
				{
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
	API.AID = 1180;
	API.APP_NAME = 'trill';
	API.HOSTNAME = 'api16-normal-c-useast1a.tiktokv.com';
	API.API_V = 'v1';
	API.VERSION_WORKING = false;
	
	API.FORMATS = [
		'play_addr',
		'play_addr_h264',
		'play_addr_bytevc1',
		'download_addr'
	];

	API.VERSIONS = [
		['26.1.3', '260103'],
		['26.1.2', '260102'],
		['26.1.1', '260101'],
		['25.6.2', '250602'],
		['24.1.5', '240105']
	];
	
	/**
	 * Builds an API query URL
	 * 
	 * @param {string} videoId 
	 */
	API.constructApiQuery = (videoId, appVersion, manifestAppVersion) =>
	{
		const fetchType = 'feed';
		const ts = Math.round(Date.now() / 1000);
	
		const parameters = {
			'aweme_id': videoId,
			'version_name': appVersion,
			'version_code': manifestAppVersion,
			'build_number': appVersion,
			'manifest_version_code': manifestAppVersion,
			'update_version_code': manifestAppVersion,
			'openudid': UTIL.ranGen('0123456789abcdef', 16),
			'uuid': UTIL.ranGen('0123456789', 16),
			'_rticket': ts * 1000,
			'ts': ts,
			'device_brand': 'Google',
			'device_type': 'Pixel 4',
			'device_platform': 'android',
			'resolution': '1080*1920',
			'dpi': 420,
			'os_version': '10',
			'os_api': '29',
			'carrier_region': 'US',
			'sys_region': 'US',
			'region': 'US',
			'app_name': API.APP_NAME,
			'app_language': 'en',
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
	API.extractId = (data, fallback = null) =>
	{
		let id = {
			user: null,
			description: null
		};
	
		/** Attempt to get the video description */
		if(UTIL.checkNested(data, 'aweme_detail', 'desc'))
		{
			id.description = data.aweme_detail.desc;
		}
	
		/** Attempt to get the channel of the video */
		(['unique_id', 'nickname', 'ins_id']).forEach((key) =>
		{
			if(!id.user && UTIL.checkNested(data, 'aweme_detail', 'author', key))
			{
				id.user = data.aweme_detail.author[key];
			}
		});
	
		if(!id.description)
		{
			id = {
				user: id.user,
				description: fallback ?
					fallback :
					(data.videoId ? data.videoId : Date.now())
			};
		}
	
		return id;
	};
	
	/**
	 * Attempts to get a response from the API
	 * 
	 * @param {string} videoId 
	 * @param {array}  version 
	 */
	API.getResponse = (videoId, version) =>
	{
		let videoData = {
			success: false,
			description: null,
			user: null,
			url: null
		};
	
		return new Promise(async (resolve, reject) =>
		{
			/** Set app version */
			let [appVersion, manifestAppVersion] = version;
	
			/** Create API query URL */
			let urlQuery = API.constructApiQuery(
				videoId,
				appVersion,
				manifestAppVersion
			);
	
			try
			{
				let response = await chrome.runtime.sendMessage(
					chrome.runtime.id, {
						task: 'fetch',
						url: urlQuery
				});

				/** Get JSON data */
				let data = response.data;

				if(response.error)
				{
					pipe('API Response failed', '@', urlQuery);
				} else if(data)
				{
					pipe('API Response:', data);
				}

				let videoUrl = null;

				/** Extract potential fallback data if available */
				if(data && UTIL.checkNested(data, 'aweme_list'))
				{
					let awemeList = data.aweme_list,
						awemeEntries = Object.keys(awemeList);

					for(let index = 0; index < awemeEntries.length; index++)
					{
						let item = awemeList[awemeEntries[index]],
							awemeId = item.aweme_id ? parseInt(item.aweme_id) : null,
							targetId = parseInt(videoId);

						if(awemeId === targetId)
						{
							/** Set list item as `aweme_detail` because the structure is the same as the default fetch method */
							data.aweme_detail = {
								...item
							};

							break;
						}
					}
				}
	
				/** Check JSON data */
				if(data && UTIL.checkNested(data, 'aweme_detail', 'video'))
				{
					/** Iterate over formats */
					(API.FORMATS).forEach((format) =>
					{
						/** Has a video URL not yet been found? */
						if(!videoUrl)
						{
							/** Check if format is available */
							if(data.aweme_detail.video.hasOwnProperty(format) &&
								data.aweme_detail.video[format].hasOwnProperty('url_list') &&
								data.aweme_detail.video[format].url_list.length > 0)
							{
								/** Set video URL */
								videoUrl = data.aweme_detail.video[format].url_list[0];
							}
						}
					});
				}
	
				/** Break and set data if a video URL has been found */
				if(videoUrl)
				{
					videoData.success = true;
					videoData.url = videoUrl;
	
					/** Set identifier */
					videoData = {
						...videoData,
						...API.extractId({
							...data,
							...{
								videoId: videoId
							}
						}),
						apiFullResponse: data
					};

					resolve(videoData);
				} else {
					reject('No `videoUrl` was found in the API response.');
				}
			} catch(error)
			{
				reject(error);
			}
		});
	}
	
	/**
	 * Attempts to fetch video URL through the API
	 * 
	 * @param {string} videoId 
	 */
	API.getVideoData = async (videoId) =>
	{
		return new Promise(async (resolve, reject) =>
		{
			let videoData = {
				success: false,
				description: null,
				user: null,
				url: null
			};

			let attemptTimeout = false;
	
			/** Get stored working manifest version */
			let manifest = API.VERSION_WORKING ? {
				working: API.VERSION_WORKING
			} : await getStoredSetting('manifest');
	
			if(manifest &&
				manifest.updated &&
				manifest.working === false)
			{
				/** If a recent failed API attempt has been made — reject the promise */
				if(((Date.now() / 1000) - manifest.updated) < 900)
				{
					attemptTimeout = true;
				}
			}

			if(manifest && manifest.working !== false)
			{
				await API.getResponse(videoId, [...manifest.working], true).then((response) =>
				{
					/** API response was good */
					if(response.success)
					{
						/** Mark that this API version is working */
						API.VERSION_WORKING = manifest.working;
		
						/** Set video data */
						videoData = {
							...videoData,
							...response
						};
					}
				}).catch((error) =>
				{
					pipe('API Attempt failed (using stored manifest):', error);
				});
			}
	
			if(!videoData.success && !attemptTimeout)
			{
				let isComplete = false;

				/** Iterate over API versions */
				for(let index = 0; index < API.VERSIONS.length; index++)
				{
					await API.getResponse(videoId, [...API.VERSIONS[index]], true).then((response) =>
					{
						pipe(`API Attempt (${index + 1}):`, { response });
		
						/** API response was good */
						if(response.success)
						{
							/** Mark that this API version is working */
							API.VERSION_WORKING = API.VERSIONS[index];
		
							/** Set video data */
							videoData = {
								...videoData,
								...response
							};

							isComplete = true;
						}
					}).catch((error) =>
					{
						pipe('API attempt failed:', error);
					});

					if(isComplete)
					{
						break;
					}
				}
			}

			if(videoData.success)
			{
				chrome.runtime.sendMessage(chrome.runtime.id,
				{
					task: 'manifestSave',
					manifest: API.VERSION_WORKING
				});

				resolve(videoData);
			} else {
				chrome.runtime.sendMessage(chrome.runtime.id,
				{
					task: 'manifestSave',
					manifest: false
				});
	
				reject(null);
			}
		});
	};

	/**
	 * Attempts to extract video data from the share popup
	 * 
	 * @param {HTMLElement} element 
	 */
	let findVideoUrls = (element) =>
	{
		let data = false;

		if(element)
		{
			/** Get shareable `a` elements */
			let anchors = element.querySelectorAll('a[href]');

			for(let i = 0; i < anchors.length; i++)
			{
				let matches = EXPR.vanillaVideoUrl(decodeURIComponent(anchors[i].getAttribute('href')));

				/** If any matches */
				if(matches)
				{
					let [, username, videoId] = matches;

					data = {
						username, videoId
					};

					break;
				}
			}
		}

		return data;
	}
	
	/**
	 * Attempts to get the `app` container
	 */
	const getAppContainer = () =>
	{
		return document.querySelector(DOM.multiSelector({
			APP: 'div#app',
			__NEXT: 'div#main'
		}));
	};
	
	/**
	 * Downloads a file
	 * 
	 * @param {string} url 
	 * @param {string} filename 
	 */
	const downloadFile = async (url, filename, buttonElement = null, isApi = false) =>
	{
		/** Sanitize filename */
		filename = UTIL.sanitizeFilename(filename), hasFallbacked = false;

		/** Truncate any super long strings */
		if(filename.length > 250)
		{
			filename = UTIL.truncateString(filename, 250);
		}
	
		/**
		 * Reverts the state of the progress button
		 * 
		 * @param {HTMLElement} buttonElement 
		 */
		let revertState = (buttonElement) =>
		{
			if(buttonElement)
			{
				buttonElement.classList.remove('loading');
			}
		}
	
		/**
		 * TikTok will sometimes return an invalid response (`TCP_MISS` || Code: 416)
		 * This causes the downloaded items to be 0 bytes.
		 * 
		 * This is a workaround for now.
		 */
		let fallback = async (url) =>
		{
			if(hasFallbacked)
			{
				return;
			}

			pipe('File could not be fetched — opening instead.');
	
			SPLASH.message(
				'[fallback] opened video in new tab [reason: fetch not allowed]', {
					duration: 3500, state: 2
				}
			);
	
			let tabActive = await getStoredSetting('download-fallback-tab-focus');
	
			chrome.runtime.sendMessage(
				chrome.runtime.id, {
					task: 'windowOpen',
					url,
					active: tabActive === null ? true : tabActive
				});
	
			revertState(buttonElement);

			hasFallbacked = true;
		};
	
		let subFolder = await getStoredSetting('download-subfolder-path');
	
		if(!(typeof subFolder === 'string' || subFolder instanceof String))
		{
			subFolder = '';
		}

		/** Attempt download using chrome API (@ `service.js`) */
		chrome.runtime.sendMessage(
			chrome.runtime.id, {
				task: 'fileDownload',
				filename,
				url,
				subFolder
			})
		.then((response) =>
		{
			if(response.success)
			{
				pipe(`Downloaded ${url}`);
	
				revertState(buttonElement);
	
				/** Show splash message */
				SPLASH.message(
					`[success] downloaded file (id: ${response.itemId}) ${isApi ? ' [method: API]' : ''}`, {
						duration: 2500, state: 1
					}
				);
			} else {
				/** Attempt download using .blob() */
				fetch(url, TTDB.headers).then((t) =>
				{
					if(t.ok)
					{
						return t.blob().then((b) =>
						{
							let anchor = document.createElement('a');
		
							anchor.href = URL.createObjectURL(b);
							anchor.setAttribute('download', filename);
	
							UTIL.dispatchEvent(anchor, MouseEvent, 'click');
	
							anchor.remove();
				
							revertState(buttonElement);
	
							/** Show splash message */
							SPLASH.message(
								`[success] downloaded file [method: blob()${isApi ? ' (API)' : ''}]`, {
									duration: 2500
								}
							);
						});
					} else {
						/** Fallback (open in new tab) */
						fallback(url);
					}
				}).catch(() =>
				{
					/** Fallback (open in new tab) */
					fallback(url);
				});
			}
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
		createPolygonSvg: (values) =>
		{
			let w3Url = 'http://www.w3.org/2000/svg';
			let [width, height] = values.dimensions;
	
			let elementSvg = document.createElementNS(w3Url, 'svg');
			let elementPolygon = document.createElementNS(w3Url, 'polygon');
	
			DOM.setAttributes(elementSvg, {
				width, height,
				viewBox: `0 0 ${width} ${height}`
			});
	
			elementPolygon.setAttribute('points', values.points.join(' '));
			elementSvg.appendChild(elementPolygon);
	
			if(values.style)
			{
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
		setStyle: (element, values) =>
		{
			let keys = Object.keys(values);
	
			(keys).forEach((key) =>
			{
				element.style[key] = values[key];
			});
		},
		/**
		 * Sets the attributes of an element
		 * 
		 * @param {HTMLElement} element 
		 * @param {object}      attributes 
		 */
		setAttributes: (element, attributes) =>
		{
			Object.keys(attributes).forEach((key) =>
			{
				element.setAttribute(key, attributes[key]);
			});
	
			return element;
		},
		/**
		 * Creates a multi-selector out of an object
		 * 
		 * @param {object} values 
		 */
		multiSelector: (values) =>
		{
			let selectors = [];
	
			Object.keys(values).forEach((key) =>
			{
				selectors.push(values[key]);
			});
	
			return selectors.join(', ');
		},
		/**
		 * Base function for creating button elements
		 * 
		 * @param {object} values
		 */
		createButton: (values) =>
		{
			let container = document.createElement('a');
			let inner = document.createElement(values.innerType ? values.innerType : 'span');
	
			if(values.content)
			{
				let [contentMode, content] = values.content || ['textContent', 'Download'];
	
				if(content instanceof Element)
				{
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
		BASIC_PLAYER: () =>
		{
			let wrapper = document.createElement('div');
	
			wrapper.classList.add('ttdb__button_basic-player_wrapper');
	
			/** Create download button */
			let button = DOM.createButton({
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
		SWIPER_SLIDE: () =>
		{
			/** Create download button */
			let button = DOM.createButton({
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
		BROWSER: () =>
		{
			/** Create download button */
			let button = DOM.createButton({
				content: ['textContent', 'Download'],
				class: 'ttdb__button_browser'
			});
	
			return button;
		},
		/** Feed items */
		FEED: () =>
		{
			/** Create download button */
			let button = DOM.createButton({
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
	
			return button;
		},
		/** Grid items (videos/liked items) */
		GRID: () =>
		{
			/** Create download button */
			let button = DOM.createButton({
				content: false,
				class: 'ttdb__button_grid'
			});
	
			return button;
		}
	};
	
	/**
	 * Attempts to extract the description/tags to use as an ID (for when no number ID is available)
	 * 
	 * @param {HTMLElement} container 
	 * @param {string}      env 
	 */
	const extractDescriptionId = (container, env = TTDB.ENV.APP) =>
	{
		let identifier = null;
		let extracted = null;
	
		if(env === TTDB.ENV.APP)
		{
			let description = container.querySelector('span[class*="-SpanText "]');
	
			if(description)
			{
				extracted = description.parentElement.textContent;
			}
		} else if(env === TTDB.ENV.__NEXT)
		{
			let metaTitle = container.querySelector('div[class*="video-meta-caption"]');
	
			if(metaTitle)
			{
				extracted = metaTitle.textContent;
			}
		}
		
		if(extracted)
		{
			extracted = extracted.replace(/[/\\?%*:|"<>]/g, '-').toLowerCase().trim();
		
			if(extracted && extracted.length > 0)
			{
				identifier = extracted;
			}
		}
	
		return identifier;
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
	const feedShareExtractId = (element, callback, timeout = 500) =>
	{
		let timer = null, shareButton = element.querySelector('button:last-child');
		let shareButtonSvg = shareButton.querySelector('span > svg');
	
		/** None of the required elements are defined — return `false` */
		if(!shareButtonSvg || !shareButton)
		{
			callback(false);
		}
	
		/** Callback wrapper */
		let respond = (response, existing = false) =>
		{
			if(!existing)
			{
				setTimeout(() =>
				{
					shareButton.classList.remove('extract');
				}, 500);

				clearTimeout(timer);

				UTIL.dispatchEvent(shareButtonSvg, MouseEvent, 'click');
			}
			
			callback(response);
		};
	
		/**
		 * Called on mutation
		 * 
		 * @param {array} mutationsList 
		 */
		let onMutate = (mutationsList) =>
		{
			for(let mutation of mutationsList)
			{
				if(mutation.type === 'childList')
				{
					let attempt = findVideoUrls(element.querySelector('div[class*="-DivContainer "]'));
					
					if(attempt)
					{
						/** Good attempt — disconnect observer */
						observer.disconnect();
	
						/** Callback */
						respond(attempt);
	
						break;
					}
				}
			}
		};

		/** Checks if a share menu already is present */
		let existingShare = element.querySelector('div[class*="-DivContainer "]');

		/** Share menu is present, clone it and extract data */
		if(existingShare)
		{
			let cloned = existingShare.cloneNode(true),
			attempt = findVideoUrls(cloned);

			if(attempt)
			{
				/** Good attempt — callback */
				respond(attempt, true);
			} else {
				/** Attempt failed */
				existingShare = false;
			}
		}

		/**
		 * If no existing share menu (this accounts for 99% of the cases)
		 * 
		 * It only really already exists if the user hovers the share button prior
		 * to the actual extraction, which is rare.
		 */
		if(!existingShare)
		{
			/** Create new observer */
			observer = new MutationObserver(onMutate);
			
			/** Start observing */
			observer.observe(shareButton, {
				childList: true,
				subtree: true
			});
		
			/** Add a temporary class to hide `Share` menu */
			shareButton.classList.add('extract');
		
			/** Simulate a click on the share button's `SVG` */
			UTIL.dispatchEvent(shareButtonSvg, MouseEvent, 'click');
		
			/** If no success within `timeout`, return `false` */
			timer = setTimeout(() =>
			{
				/** Stop observing */
				observer.disconnect();
				respond(false);
			}, timeout);
		}
	
		return false;
	};
	
	const itemData = {
		extract: {}
	};
	
	/** Feed items (`For Your` page etc.) */
	itemData.extract[TTDB.MODE.FEED] = (data) =>
	{
		let videoData = {}, itemUser = data.container.querySelector(DOM.multiSelector({
			app: 'a > [class*="AuthorTitle "]',
			__next: 'h3.author-uniqueId'
		}));
	
		if(itemUser)
		{
			/** Set username */
			videoData.user = itemUser.textContent;
		} else {
			/** Fallback username fetch */
			itemUser = data.container.querySelector('a[href^="/@"]');
	
			if(itemUser)
			{
				videoData.user = itemUser.getAttribute('href').split('/@')[1];
	
				if(videoData.user.includes('?'))
				{
					videoData.user = videoData.user.split('?')[0];
				}
			}
		}
	
		/** Get alternative id (no ID available here) */
		let descriptionIdentifier = extractDescriptionId(data.container, data.env);
		/** Set `descriptionIdentifier` or fallback */
		videoData.id = descriptionIdentifier ? descriptionIdentifier : Date.now();
	
		return videoData;
	};
	
	/** Grid items (videos from user page, liked videos etc.) */
	itemData.extract[TTDB.MODE.GRID] = (data) =>
	{
		let videoData = {}, itemLinks = data.container.querySelectorAll('a[href*="com/@"]');
	
		(itemLinks).forEach((link) =>
		{
			let matches = EXPR.vanillaVideoUrl(link.getAttribute('href'), {
				strict: true
			});
	
			if(matches)
			{
				let [, user, id] = matches;
	
				videoData.user = user;
				videoData.id = id;
	
				if(/^\d+$/.test(id))
				{
					videoData.videoApiId = id;
				}
			}
		});
	
		return videoData;
	};
	
	/** Browser items (when opened a video grid item or on the `For You` page) */
	itemData.extract[TTDB.MODE.BROWSER] = (data) =>
	{
		let videoData = {}, itemUser = null;
	
		if(data.env === TTDB.ENV.APP)
		{
			/** Get username */
			itemUser = data.container.querySelector('div[class*="-DivInfoContainer "] a[href*="/@"]');

			if(itemUser)
			{
				videoData.user = itemUser.getAttribute('href').split('/@')[1];
				if(videoData.user.includes('?'))
				{
					videoData.user = videoData.user.split('?')[0];
				}
			}

			let copyElement = data.container.querySelector('p[class*="-PCopyLinkText "]');

			if(copyElement)
			{
				/** Get data from copy link URL */
				let matches = EXPR.vanillaVideoUrl(copyElement.textContent);
				let [, username, videoId] = matches;

				videoData.user = username;
				videoData.videoApiId = videoId;
			} else {
				/** Get data from share URLs */
				let shareData = findVideoUrls(data.container);

				if(shareData)
				{
					videoData.user = shareData.username;
					videoData.videoApiId = shareData.videoId;
				}
			}
		} else if(data.env === TTDB.ENV.__NEXT)
		{
			/** Get username */
			itemUser = data.container.querySelector('div.user-info a > h2.user-username');
	
			if(itemUser)
			{
				videoData.user = itemUser.textContent.trim();
			}
		}
	
		/** Get alternative id (no ID available here) */
		let descriptionIdentifier = extractDescriptionId(data.container, data.env);
	
		if(descriptionIdentifier)
		{
			videoData.id = descriptionIdentifier;
		}
	
		return videoData;
	};
	
	itemData.extract[TTDB.MODE.BASIC_PLAYER] = (data) =>
	{
		let videoData = {}, parent = data.container.closest('div[class*="-DivLeftContainer "]');
	
		if(parent)
		{
			let userId = parent.querySelectorAll(
				'span[class*="-SpanUniqueId "], span[data-e2e="browse-username"]'
			);
	
			if(userId[0])
			{
				videoData.user = userId[0].textContent.trim();
			} else {
				/** User ID fallback */
				let authorElement = parent.querySelector('div[class*="-DivAuthorContainer "]');
	
				if(authorElement)
				{
					let userHref = authorElement.querySelectorAll('a[href^="/@"]');
	
					if(userHref[0])
					{
						videoData.user = userHref[0].getAttribute('href').split('/@')[1].trim();
	
						if(videoData.user.includes('?'))
						{
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
	
			if(videoTags)
			{
				videoTags = [...videoTags].map((e) =>
				{
					return e.textContent ? e.textContent.trim() : false;
				});
	
				videoTags = videoTags.filter((e) => e);
				videoData.id = videoTags.join(' ');
			}
		}
	
		/** Get user and video id from URL */
		let matches = EXPR.vanillaVideoUrl(window.location.href);
		
		if(matches)
		{
			let [, user, videoId] = matches;
	
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
	itemData.get = (container, data) =>
	{
		let videoData = {
			id: null,
			user: null,
			url: null
		};
	
		let videoElement = container.querySelector('video');
	
		if(videoElement &&
			itemData.extract[data.mode])
		{
			/** Get actual video download URL */
			videoData.url = videoElement.getAttribute('src');
	
			let extractedData = itemData.extract[data.mode](data);
	
			videoData = {
				...videoData,
				...extractedData
			};
	
			if(!videoData.id)
			{
				videoData.id = Date.now();
			}
		}
	
		return videoData;
	};
	
	/**
	* Fetches video items
	*/
	const selectAllVideoItems = () =>
	{
		let selectors = DOM.multiSelector({
			appItemContainer: 'div[class*="-DivItemContainer"]:not([is-downloadable]):not([class*="-kdocy-"])',
			appBrowserMode: 'div[class*="-DivBrowserModeContainer "]:not([is-downloadable])',
			appSwiperSlide: 'div.swiper div.swiper-slide:not([is-downloadable])',
			appBasicPlayer: 'div[class*="-DivLeftContainer "] div[class*="-DivVideoContainer "] \
				div[class*="-DivContainer "]:not([is-downloadable])',
			__nextGrid: 'div.video-feed div.video-feed-item:not([is-downloadable])',
			__nextBig: 'div.video-feed-container div.feed-item-content:not([is-downloadable])',
			__nextBrowser: 'div.tt-feed div.video-card-big.browse-mode:not([is-downloadable])'
		});
	
		return document.querySelectorAll(selectors);
	};

	/**
	 * Object getter using dot notation
	 */
	const _get = (obj, path, defValue) =>
	{
		if(!path)
		{
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
	const getFileNameTemplate = (data, template = '{uploader} - {desc}') =>
	{
		const [apiData] = [data.apiFullResponse];
		const templateValues = {};

		/**
		 * Desired template data of the keys
		 */
		const templateKeys = {
			/** User ID (their @ID) */
			uploader: [data.user, ['aweme_detail', 'author', 'unique_id']],
			/** User nickname (full username), not their @ID */
			nickname: [['aweme_detail', 'author', 'nickname']],
			/** Video description */
			desc: [data.description, ['aweme_detail', 'author', 'unique_id']],
			/** User ID */
			uid: [['aweme_detail', 'author', 'uid'], ['aweme_detail', 'author_user_id']],
			/** Video ID */
			id: [data.videoId],
			/** Video region */
			region: [['aweme_detail', 'region']],
			/** Video language */
			language: [['aweme_detail', 'author', 'language']],
			/** Uploaders signature (their profile description) */
			signature: [['aweme_detail', 'author', 'signature']],
			/** Upload timestamp (Unix) */
			uploaded: [['aweme_detail', 'create_time']],
			/** Current timestamp (Unix) */
			timestamp: [Math.round(Date.now() / 1000)]
		};

		/**
		 * Get template options from the API data
		 */
		for(const [key, value] of Object.entries(templateKeys))
		{
			if(!templateValues.hasOwnProperty(key))
			{
				let keyData = null;

				for(const item of value)
				{
					if(!Array.isArray(item) && item)
					{
						keyData = item; break;
					} else if(Array.isArray(item) && UTIL.checkNested(apiData, ...item))
					{
						keyData = _get(apiData, item.join('.')); break;
					}
				}

				/** Set template key value, revert to a nulled string */
				templateValues[key] = keyData || '';
			}
		}

		/**
		 * Create readable timestamps
		 */
		for(const timestamp of ['uploaded', 'timestamp'])
		{
			if(Number.isInteger(templateValues[timestamp])
				&& templateValues[timestamp] > 0)
			{
				/** Convert to `Date` object */
				const ts = new Date(templateValues[timestamp] * 1000);

				/** Get required date values */
				const tsData = {
					year: ts.getFullYear(),
					month: ts.getMonth() + 1,
					day: ts.getDate(),
					hour: ts.getHours(),
					minute: ts.getMinutes(),
					second: ts.getSeconds()
				};

				/** Pad any values under ten */
				for(const [key, value] of Object.entries(tsData))
				{
					if(value < 10) tsData[key] = `0${value}`;
				}

				/** Format date */
				const tsDate = `${tsData.year}${tsData.month}${tsData.day}`;

				/** Format time */
				const tsTime = `${tsData.hour}${tsData.minute}${tsData.second}`;

				/** Set template key value */
				templateValues[`${timestamp}_s`] = `${tsDate}_${tsTime}`;
			}
		}

		let filename = template;

		/**
		 * Replace template options with actual values
		 */
		for(const [key, value] of Object.entries(templateValues))
		{
			filename = filename.replace(`{${key}}`, value);
		}

		/**
		 * Remove any remaining template options
		 */
		filename = filename.replace(/({[^}]+})/g, '');

		if(!filename.endsWith('.mp4'))
		{
			filename = `${filename}.mp4`;
		}

		return filename.length >= 5 ? filename : null;
	};
	
	const downloadHook = async (button, videoData) =>
	{
		let videoIdentifier = videoData.id ? videoData.id : Date.now();
		let fileName = `${videoData.user ? videoData.user + ' - ' : ''}${videoIdentifier}`;
	
		DOM.setAttributes(button, {
			'href': videoData.url,
			'filename': `${fileName.trim()}.mp4`,
			'download': fileName
		});
	
		if(videoData.videoApiId)
		{
			button.setAttribute('video-id', videoData.videoApiId);
		}
	
		if(!button.hasListener)
		{
			button.addEventListener('click', async (e) =>
			{
				/** Override default click behavior */
				e.preventDefault();

				if(button.classList.contains('loading'))
				{
					/** It's already loading */
					return false;
				} else {
					/** Set loading state */
					button.classList.add('loading');
				}

				let attrUrl = button.getAttribute('href') || null;
				let attrFilename = button.getAttribute('filename') || null;
				let attrApiId = button.getAttribute('video-id') || null;

				/** TikTok generated blob() URLs can't be downloaded, so force API on those, otherwise get value from settings */
				let useApi = attrUrl.startsWith('blob:') ? true : await getStoredSetting('download-prioritize-api');
	
				/** If a video ID is present and `useApi` is enabled, attempt to get API data */
				if(useApi && attrApiId)
				{
					/** Attempt to download non-watermarked version by using the API */
					await API.getVideoData(attrApiId).then(async (res) =>
					{
						let fileName = (
							`${res.user ? (res.user + ' - ') : ''}${res.description.trim()}.mp4`
						);

						try
						{
							const nameTemplate = await getStoredSetting('download-naming-template');

							if(nameTemplate && nameTemplate.length >= 1)
							{
								/** Get template file name */
								let templateFilename = getFileNameTemplate(
									{...res, ...{ videoId: attrApiId }}, nameTemplate
								);
	
								/** Set template file name if accepted */
								fileName = templateFilename ? templateFilename : fileName;
	
								pipe('Using template:', {
									template: nameTemplate,
									filename: fileName
								});
							}
						} catch(e) {
							pipe('Failed to use template', e);
						}

						downloadFile(res.url, fileName, button, true);
					}).catch(() =>
					{
						/** Attempt to download watermarked video as fallback */
						if(attrUrl && attrFilename)
						{
							downloadFile(attrUrl, attrFilename, button);
						}
					});
				} else {
					/** Download watermarked video */
					if(attrUrl && attrFilename)
					{
						downloadFile(attrUrl, attrFilename, button);
					}
				}
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
	
	const itemSetup = {
		setters: {}
	};
	
	itemSetup.setters[TTDB.MODE.BROWSER] = (item, data) =>
	{
		let linkContainer = null;

		if(data.env === TTDB.ENV.APP)
		{
			linkContainer = item.querySelector('div[class*="-DivCopyLinkContainer "]');
		} else if(data.env === TTDB.ENV.__NEXT)
		{
			linkContainer = item.querySelector('div.video-infos-container > div.action-container');
		}
	
		if(linkContainer)
		{
			/** Mark container as handled */
			item.setAttribute('is-downloadable', 'true');

			/** Create download button */
			let button = createButton.BROWSER();
			let videoData = itemData.get(item, data);
	
			if(data.env === TTDB.ENV.APP)
			{
				linkContainer.before(button);
			} else if(data.env === TTDB.ENV.__NEXT)
			{
				linkContainer.after(button);
			}
			
			button.setAttribute('ttdb_mode', data.env === TTDB.ENV.__NEXT ? '__NEXT' : 'APP');
	
			downloadHook(button, videoData);
	
			if(TTDB.observers.browserObserver)
			{
				TTDB.observers.browserObserver.disconnect();
			}
	
			let callback = (mutationsList) =>
			{
				for(let mutation of mutationsList)
				{
					if(mutation.type === 'childList')
					{
						clearTimeout(TTDB.timers.browserObserver);
	
						TTDB.timers.browserObserver = setTimeout(() =>
						{
							downloadHook(button, itemData.get(item, data));
						}, 100);
					}
				}
			};
	
			TTDB.observers.browserObserver = new MutationObserver(callback);
	
			/** Observe any changes when navigating through items */
			TTDB.observers.browserObserver.observe(item, {
				childList: true,
				subtree: true
			});
	
			return true;
		}
	
		return false;
	};
	
	itemSetup.setters[TTDB.MODE.GRID] = (item, data) =>
	{
		item.setAttribute('is-downloadable', 'true');
	
		/** Create download button */
		let button = createButton.GRID();

		let setButton = (videoData, button) =>
		{
			pipe('Found video data:', videoData);

			/** We have a valid video URL — set download data */
			if(videoData.url && !button.ttIsProcessed)
			{
				downloadHook(button, videoData);
				button.ttIsProcessed = true;
			}
		}

		item.addEventListener('mouseleave', () =>
		{
			/** Clear any active timers on `mouseleave` */
			clearInterval(TTDB.timers.gridAwaitVideoData);
		});
	
		item.addEventListener('mouseenter', () =>
		{
			if(!button.ttIsProcessed)
			{
				clearInterval(TTDB.timers.gridAwaitVideoData);

				let videoData = itemData.get(item, data);
	
				/** No URL was found on the initial attempt */
				if(!videoData.url)
				{
					/** Check for existing video URLs */
					TTDB.timers.gridAwaitVideoData = setInterval(() =>
					{
						videoData = itemData.get(item, data);
	
						/** We have a valid video URL — set download data and clear interval */
						if(videoData.url)
						{
							setButton(videoData, button);
							clearInterval(TTDB.timers.gridAwaitVideoData);
						}
					}, 20);
				} else {
					/** We have a valid video URL — set download data */
					setButton(videoData, button);
				}
			}
		});
	
		DOM.setStyle(item, {
			'position': 'relative'
		});
	
		item.appendChild(button);
	
		setTimeout(() =>
		{
			button.style.opacity = 1;
		}, 100);
	
		return true;
	};
	
	itemSetup.setters[TTDB.MODE.FEED] = (item, data) =>
	{
		let videoPreview = item.querySelector(data.env === TTDB.ENV.APP ?
			'div[class*="-DivContainer "][mode] > img' :
			'div[class*="video-card"] > span[class$="mask"]'
		);
	
		if(videoPreview)
		{
			item.setAttribute('is-downloadable', 'true');
	
			/** Create download button */
			let button = createButton.FEED();
	
			/** Container for existing buttons (like, comment and share) */
			let actionContainer = item.querySelector(data.env === TTDB.ENV.APP ?
				'div[class*="-DivActionItemContainer "]' :
				'div[class*="-action-bar"].vertical'
			);
	
			if(!actionContainer)
			{
				return false;
			} else {
				actionContainer.prepend(button);
			}
	
			let videoDataOnSetup = itemData.get(item, data);
	
			if(videoDataOnSetup.url && !button.ttIsProcessed)
			{
				/** Attempt to get video id (for API support) */
				feedShareExtractId(actionContainer, (res) =>
				{
					if(res.videoId)
					{
						button.setAttribute('video-id', res.videoId);
					}
				});
	
				setTimeout(() =>
				{
					button.style.opacity = 1;
				}, 50);
	
				/** Item has already loaded when being set up, so set up download button */
				downloadHook(button, videoDataOnSetup);
	
				button.ttIsProcessed = true;
			} else {
				/** Item has not loaded, so we'll prepare and watch for it */
				let container = videoPreview.parentElement;
	
				let callback = (mutationsList, observer) =>
				{
					for(let mutation of mutationsList)
					{
						if(mutation.type === 'childList')
						{
							let videoData = itemData.get(item, data);
	
							/** We have a valid video URL, so set download data */
							if(videoData.url && !button.ttIsProcessed)
							{
								/** Attempt to get video id (for API support) */
								feedShareExtractId(actionContainer, (res) =>
								{
									if(res.videoId)
									{
										button.setAttribute('video-id', res.videoId);
									}
								});
	
								/** Stop observing */
								observer.disconnect();
	
								setTimeout(() =>
								{
									button.style.opacity = 1;
								}, 50);
	
								/** Set up download button */
								downloadHook(button, videoData);
	
								button.ttIsProcessed = true;
							}
						}
					}
				};
				
				let observer = new MutationObserver(callback);
		
				observer.observe(container, {
					childList: true,
					subtree: true
				});
			}
	
			return true;
		}
	
		return false;
	};
	
	/** Set up swiper slide item (may be obsolete) */
	itemSetup.setters[TTDB.MODE.SWIPER_SLIDE] = (item, data) =>
	{
		let videoPreview = item.querySelector('img');
		let videoElement = item.querySelector('video');
		let videoWrapper = item.querySelector('div[class*="VideoWrapperForSwiper"]');
	
		if((videoElement || videoPreview) && videoWrapper)
		{
			item.setAttribute('is-downloadable', 'true');
	
			/** Create download button */
			let button = createButton.SWIPER_SLIDE();
			videoWrapper.prepend(button);
	
			/** We already have a video element */
			if(videoElement)
			{
				let videoData = itemData.get(item, data);
	
				/** We have a valid video URL, so set download data */
				if(videoData.url && !button.ttIsProcessed)
				{
					setTimeout(() => button.style.opacity = 1, 50);
	
					/** Set up download button */
					downloadHook(button, videoData);
					button.ttIsProcessed = true;
				} else {
					videoElement = null;
				}
			}
	
			/** Only preview, no video yet */
			if(videoPreview && !videoElement)
			{
				/** Item has not loaded, so we'll prepare and watch for it */
				let observer = null, container = videoWrapper;
	
				let callback = (mutationsList, observer) =>
				{
					for(let mutation of mutationsList)
					{
						if(mutation.type === 'childList')
						{
							let videoData = itemData.get(item, data);
		
							/** We have a valid video URL, so set download data */
							if(videoData.url && !button.ttIsProcessed)
							{
								/** Stop observing */
								observer.disconnect();
	
								setTimeout(() => button.style.opacity = 1, 50);
	
								/** Set up download button */
								downloadHook(button, videoData);
	
								button.ttIsProcessed = true;
							}
						}
					}
				};
				
				observer = new MutationObserver(callback);
		
				observer.observe(container, {
					childList: true,
					subtree: true
				});
			}
	
			return true;
		}
	
		return false;
	};
	
	/** Set up basic player item ("theater" mode) */
	itemSetup.setters[TTDB.MODE.BASIC_PLAYER] = (item, data) =>
	{
		let videoElement = item.querySelector('video');
	
		if(videoElement)
		{
			item.setAttribute('is-downloadable', 'true');
	
			/** Create download button */
			let button = createButton.BASIC_PLAYER();
			let parent = data.container.closest('div[class*="-DivLeftContainer "]');
	
			if(parent)
			{
				let existingButton = parent.querySelector(`.${button.classList[0]}`);
			
				if(existingButton)
				{
					existingButton.remove();
				}

				parent.children[0].parentNode.insertBefore(
					button, parent.children[0].nextSibling
				);
	
				button = button.querySelector('a');
	
				let widthTarget = parent.querySelector('div[class*="-DivInfoContainer "]');
	
				DOM.setStyle(button, {
					'width': `${widthTarget ? widthTarget.offsetWidth : 320}px`
				});
	
				/** We already have a video element */
				if(videoElement)
				{
					let videoData = itemData.get(item, data);
	
					/** We have a valid video URL, so set download data */
					if(videoData.url && !button.ttIsProcessed)
					{
						button.parentNode.style.display = 'inherit';
						setTimeout(() => button.style.opacity = 1, 50);
	
						/** Set up download button */
						downloadHook(button, videoData);
	
						button.ttIsProcessed = true;
					} else {
						videoElement = null;
					}
				}
			}
		}
	};
	
	/**
		* Set up item (get data, create download button and hooks)
		* 
		* @param {string}      itemType 
		* @param {HTMLElement} item 
		* @param {object}      data 
		*/
	itemSetup.set = (itemType, item, data) =>
	{
		return itemSetup.setters[itemType](item, data);
	};
	
	/**
		* Updates video items
		*/
	const updateItems = () =>
	{
		let processed = 0;

		(selectAllVideoItems()).forEach((item) =>
		{
			let currentMode = null, currentEnvironment = null;
			let modeElement = item.querySelector('div[mode]');
	
			if(modeElement)
			{
				currentMode = modeElement.getAttribute('mode');
				currentEnvironment = TTDB.ENV.APP;
			} else {
				let classList = item.classList;

				if(classList.contains('video-feed-item') || classList.contains('three-column-item'))
				{
					currentMode = TTDB.MODE.GRID;
				} else if(classList.contains('feed-item-content'))
				{
					currentMode = TTDB.MODE.FEED;
				} else if(classList.contains('browse-mode') || classList.contains('video-card-big'))
				{
					currentMode = TTDB.MODE.BROWSER;
				} else if(classList.contains('swiper-slide'))
				{
					currentMode = TTDB.MODE.SWIPER_SLIDE;
				} else if(item.querySelector('div.no-controls > video'))
				{
					currentMode = TTDB.MODE.BASIC_PLAYER;
				}
	
				if(currentMode !== null)
				{
					currentEnvironment = TTDB.ENV.__NEXT;
				}
			}

			if(currentMode)
			{
				/** Set default environment if nothing has been detected */
				if(currentEnvironment === null)
				{
					currentEnvironment = TTDB.DEFAULT_ENV;
				}
	
				/** Data that we're sending downstream */
				let data = {
					mode: currentMode,
					env: currentEnvironment,
					container: item
				};
	
				if(itemSetup.set(currentMode, item, data))
				{
					processed++;
				}
			}
		});
	
		return processed;
	};
	
	/**
		* Adds download buttons to video elements
		*/
	const updatePage = () =>
	{
		let processedItems = updateItems();
	
		if(processedItems > 0)
		{
			pipe(`Processed ${processedItems} item${processedItems !== 1 ? 's' : ''}!`);
		}
	};
	
	/**
		* Check for updates on `scroll`
		*/
	document.addEventListener('scroll', () =>
	{
		clearTimeout(TTDB.timers.scrollBreak);
	
		TTDB.timers.scrollBreak = setTimeout(() =>
		{
			TTDB.setInterval(20);
		}, 250);
	});
	
	/**
	* Check for updates on `click`
	*/
	window.addEventListener('click', () =>
	{
		TTDB.setInterval(10);
	});
	
	let observeApp = (container) =>
	{
		if(TTDB.observers.main)
		{
			TTDB.observers.main.disconnect();
		}
	
		let callback = (mutationsList) =>
		{
			for(let mutation of mutationsList)
			{
				if(mutation.type === 'childList')
				{
					clearTimeout(TTDB.timers.appUpdated);
	
					TTDB.timers.appUpdated = setTimeout(() =>
					{
						TTDB.setInterval(15);
					}, 500);
				}
			}
		};
		
		TTDB.observers.main = new MutationObserver(callback);
	
		TTDB.observers.main.observe(container, {
			childList: true,
			subtree: true
		});
	
		pipe('Watching for DOM changes ..');
	};
	
	let appContainer = getAppContainer();
	
	if(appContainer)
	{
		observeApp(appContainer);
	} else {
		let checks = 0;
	
		TTDB.timers.appCreationWatcher = setInterval(() =>
		{
			appContainer = getAppContainer();
	
			if(appContainer || checks === 10)
			{
				clearInterval(TTDB.timers.appCreationWatcher);
	
				if(appContainer)
				{
					observeApp(appContainer);
				}
			}
	
			checks++;
		}, 1000);
	}
	
	/**
	* Tracks and does item checks on the page
	*/
	setInterval(() =>
	{
		if(TTDB.interval.counter > 0)
		{
			updatePage();
			
			TTDB.interval.counter--;
		}
	}, TTDB.interval.delay);
	
	/** Create splash elements */
	SPLASH.create();
})();