(() =>
{
	const ttdb_data = {};

	ttdb_data.timers = {};
	ttdb_data.observers = {};
	ttdb_data.recentTrigger = null;

	/**
	 * Interval object
	 * 
	 * Sets the amount of update attempts that should be done
	 */
	 ttdb_data.interval = {
		counter: 50,
		delay: 250
	 };

	
	/**
	 * Sets the amount of item checks to do
	 * 
	 * @param {integer} count 
	 */
	const ttdb_setInterval = (count, trigger = null) =>
	{
		if(ttdb_data.interval.counter < count)
		{
			ttdb_data.interval.counter = count
		}

		if(trigger)
		{
			ttdb_data.recentTrigger = trigger;
		}
	};

	/**
	 * Log to console
	 * 
	 * @param  {...any} args 
	 */
	const pipe = (...args) =>
	{
		console.log(`[TTDB]`, ...args)
	}

	/**
	 * Different item modes
	 */
	ttdb_data.MODE = {
		FEED: '0',
		GRID: '1',
		BROWSER: '2',
		SWIPER_SLIDE: '3'
	};

	/**
	 * Different environments
	 * 
	 * `APP` is the main environment (most regions)
	 * `__NEXT` has a different HTML structure (region=US)
	 */
	 ttdb_data.ENV = {
		APP: Symbol(true),
		__NEXT: Symbol(true),
	};

	ttdb_data.DEFAULT_ENV = ttdb_data.ENV.APP;

	/**
	 * `fetch` headers for downloading videos
	 * 
	 * https://developer.mozilla.org/en-US/docs/Web/API/fetch
	 */
	ttdb_data.headers = {
		method: 'GET',
		mode: 'cors',
		cache: 'no-cache',
		credentials: 'same-origin',
		redirect: 'follow'
	};

	/**
	 * Attempts to get the `app` container
	 */
	const ttdb_getAppContainer = () =>
	{
		return document.querySelector(ttdb_DOM.multiSelector({
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
	const ttdb_downloadFile = (url, filename, buttonElement = null) =>
	{
		if(buttonElement)
		{
			buttonElement.style.cursor = 'progress';
		}

		/**
		 * TikTok will sometimes return an invalid response (`TCP_MISS` || Code: 416)
		 * This causes the downloaded items to be 0 bytes.
		 * 
		 * This is a workaround for now.
		 */
		let fallback = (url) =>
		{
			pipe('File could not be fetched — opening instead.');
			window.open(url, '_blank').focus();
		};

		fetch(url, ttdb_data.headers).then((t) =>
		{
			if(t.ok)
			{
				return t.blob().then((b) =>
				{
					let a = document.createElement('a');

					a.href = URL.createObjectURL(b);
					a.setAttribute('download', filename);
					a.click();
		
					if(buttonElement)
					{
						buttonElement.style.cursor = 'pointer';
					}
	
					pipe(`Downloaded: ${url}`);
				});
			} else {
				fallback(url);
			}
		}).catch(() =>
		{
			fallback(url);
		});
	};

	/**
	 * DOM manipulation functions
	 */
	const ttdb_DOM = {
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
	
			ttdb_DOM.setAttributes(elementSvg, {
				width, height,
				viewBox: `0 0 ${width} ${height}`
			});

			elementPolygon.setAttribute('points', values.points.join(' '));
			elementSvg.appendChild(elementPolygon);

			if(values.style)
			{
				ttdb_DOM.setStyle(elementSvg, values.style);
			}
	
			return elementSvg;
		},
		/**
		 * Sets the CSS style of an element
		 * 
		 * @param {HTMLElement} element 
		 * @param {object} values 
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
		 * @param {object} attributes 
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
	const ttdb_createButton = {
		/** Swiper slide items */
		SWIPER_SLIDE: () =>
		{
			/** Create download button */
			let button = ttdb_DOM.createButton({
				content: ['appendChild', ttdb_DOM.createPolygonSvg({
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
			ttdb_DOM.setStyle(button, {
				'background-color': 'rgba(0, 0, 0, 0.25)',
				'color': '#000'
			});
	
			return button;
		},
		/** Browser items (full-view items) */
		BROWSER: () =>
		{
			/** Create download button */
			let button = ttdb_DOM.createButton({
				content: ['textContent', 'Download'],
				class: 'ttdb__button_browser'
			});
	
			/** Set directly, as this makes it more compatible with dark mode addons */
			ttdb_DOM.setStyle(button, {
				'background-color': '#f1f1f2',
				'color': '#000'
			});
	
			return button;
		},
		/** Feed items */
		FEED: () =>
		{
			/** Create download button */
			let button = ttdb_DOM.createButton({
				content: ['appendChild', ttdb_DOM.createPolygonSvg({
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
				class: 'ttdb__button_feed'
			});
	
			/** Set directly, as this makes it more compatible with dark mode addons */
			ttdb_DOM.setStyle(button, {
				'background-color': '#f1f1f2',
				'color': '#000'
			});
	
			return button;
		},
		/** Grid items (videos/liked items) */
		GRID: () =>
		{
			/** Create download button */
			let button = ttdb_DOM.createButton({
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
	 * @param {string} env 
	 */
	const ttdb_extractDescriptionId = (container, env = ttdb_data.ENV.APP) =>
	{
		let identifier = null;
		let extracted = null;

		if(env === ttdb_data.ENV.APP)
		{
			let descriptionElement = container.querySelector('span[class*="-SpanText "][class^="tiktok-"]');
	
			if(descriptionElement)
			{
				extracted = descriptionElement.parentElement.textContent;
			}
		} else if(env === ttdb_data.ENV.__NEXT)
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
	 * Retrieves video id, user and url from a grid item
	 * 
	 * @param {HTMLElement} container 
	 */
	const ttdb_getVideoData = (container, data = {}) =>
	{
		let videoData = {
			id: null,
			user: null,
			url: null
		};

		let videoElement = container.querySelector('video');
	
		if(videoElement)
		{
			/** Feed items */
			if(data.mode === ttdb_data.MODE.FEED)
			{
				/** Get username */
				let itemUser = data.container.querySelector(ttdb_DOM.multiSelector({
					app: 'a > [class*="AuthorTitle "][class^="tiktok-"]',
					__next: 'h3.author-uniqueId'
				}));
	
				if(itemUser)
				{
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
				let descriptionIdentifier = ttdb_extractDescriptionId(data.container, data.env);
				videoData.id = descriptionIdentifier ? descriptionIdentifier : Date.now() /** Fallback */;
			/** Grid items */
			} else if(data.mode === ttdb_data.MODE.GRID)
			{
				if(!videoData.id || !videoData.user)
				{
					let itemLinks = data.container.querySelectorAll('a[href*="com/@"]');
	
					(itemLinks).forEach((link) =>
					{
						let re = new RegExp('^https?:\/\/(?:www\.)?tiktok\.com\/@([^\/]+)\/video\/([0-9]+)$');
						let matches = re.exec(link.getAttribute('href'));
		
						if(matches.length === 3)
						{
							let [, user, id] = matches;
		
							videoData.user = user;
							videoData.id = id;
						}
					});
				}
			/** Browser items */
			} else if(data.mode === ttdb_data.MODE.BROWSER)
			{
				if(!videoData.id || !videoData.user)
				{
					let itemUser = null;

					/** Get username */
					if(data.env === ttdb_data.ENV.APP)
					{
						itemUser = data.container.querySelector('div[class*="-DivInfoContainer "] a[href*="/@"]');
						videoData.user = itemUser ? itemUser.getAttribute('href').split('/@')[1] : 'tiktok_video' /** Fallback */;

						if(itemUser && videoData.user.includes('?'))
						{
							videoData.user = videoData.user.split('?')[0];
						}
					} else if(data.env === ttdb_data.ENV.__NEXT)
					{
						itemUser = data.container.querySelector('div.user-info a > h2.user-username');

						if(itemUser)
						{
							videoData.user = itemUser.textContent.trim();
						}
					}

					/** Get alternative id (no ID available here) */
					let descriptionIdentifier = ttdb_extractDescriptionId(data.container, data.env);
					videoData.id = descriptionIdentifier ? descriptionIdentifier : Date.now() /** Fallback */;
				}
			}
	
			/** Get actual video download URL */
			videoData.url = videoElement.getAttribute('src');
		}
	
		return videoData;
	};
	
	/**
	 * Fetches video items
	 */
	const ttdb_getVideoItems = () =>
	{
		let selectors = ttdb_DOM.multiSelector({
			appItemContainer: 'div[class*="-DivItemContainer"][class^="tiktok-"]:not([is-downloadable]):not([class*="-kdocy-"])',
			appBrowserMode: 'div[class*="-DivBrowserModeContainer "][class^="tiktok-"]:not([is-downloadable])',
			appSwiperSlide: 'div.swiper div.swiper-slide:not([is-downloadable])',
			__nextGrid: 'div.video-feed div.video-feed-item:not([is-downloadable])',
			__nextBig: 'div.video-feed-container div.feed-item-content:not([is-downloadable])',
			__nextBrowser: 'div.tt-feed div.video-card-big.browse-mode:not([is-downloadable])'
		});
	
		return document.querySelectorAll(selectors);
	};

	const ttdb_hookDownload = (button, videoData, recreate = false) =>
	{
		let fileName = (videoData.id && videoData.user) ? `${videoData.user}-${videoData.id}` : Date.now();
	
		ttdb_DOM.setAttributes(button, {
			'href': videoData.url,
			'filename': `${fileName}.mp4`,
			'download': fileName
		});

		if(!button.ttdb_hasListener)
		{
			button.addEventListener('click', (e) =>
			{
				/** Override default click behavior */
				e.preventDefault();

				let attrUrl = button.getAttribute('href') || null;
				let attrFilename = button.getAttribute('filename') || null;
		
				/** Download file using this function instead */
				if(attrUrl && attrFilename)
				{
					ttdb_downloadFile(attrUrl, attrFilename, e.target);
				}
			});

			button.ttdb_hasListener = true;
		}

		/** Download data has been set, make element interactable again */
		ttdb_DOM.setStyle(button, {
			'cursor': 'pointer',
			'pointer-events': 'auto'
		});
	
		return button;
	}

	const ttdb_setupItem = {
		/** Set up swiper slide item */
		SWIPER_SLIDE: (item, data) =>
		{
			let videoPreview = item.querySelector('img');
			let videoElement = item.querySelector('video');
			let videoWrapper = item.querySelector('div[class*="VideoWrapperForSwiper"]');

			if((videoElement || videoPreview) && videoWrapper)
			{
				item.setAttribute('is-downloadable', 'true');

				/** Create download button */
				let button = ttdb_createButton.SWIPER_SLIDE();

				videoWrapper.prepend(button);

				/** We already have a video element */
				if(videoElement)
				{
					let videoData = ttdb_getVideoData(item, data);

					/** We have a valid video URL, so set download data */
					if(videoData.url && !button.ttIsProcessed)
					{
						setTimeout(() =>
						{
							button.style.opacity = 1;
						}, 50);

						/** Set up download button */
						ttdb_hookDownload(button, videoData);

						button.ttIsProcessed = true;
					} else {
						videoElement = null;
					}
				}

				/** Only preview, no video yet */
				if(videoPreview && !videoElement)
				{
					let observer = null;

					/** Item has not loaded, so we'll prepare and watch for it */
					let container = videoWrapper;
		
					let callback = (mutationsList, observer) =>
					{
						for(let mutation of mutationsList)
						{
							if(mutation.type === 'childList')
							{
								let videoData = ttdb_getVideoData(item, data);
			
								/** We have a valid video URL, so set download data */
								if(videoData.url && !button.ttIsProcessed)
								{
									/** Stop observing */
									observer.disconnect();

									setTimeout(() =>
									{
										button.style.opacity = 1;
									}, 50);

									/** Set up download button */
									ttdb_hookDownload(button, videoData);

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
		},
		/** Set up feed item */
		FEED: (item, data) =>
		{
			let videoPreview = null;

			if(data.env === ttdb_data.ENV.APP)
			{
				videoPreview = item.querySelector('div[class*="-DivContainer "][class^="tiktok-"] > img');
			} else if(data.env === ttdb_data.ENV.__NEXT)
			{
				videoPreview = item.querySelector('div[class*="video-card"] > span[class$="mask"]');
			}


			if(videoPreview)
			{
				item.setAttribute('is-downloadable', 'true');

				/** Create download button */
				let button = ttdb_createButton.FEED();

				/** Container for existing buttons (like, comment and share) */
				let actionContainer = null;
				
				if(data.env === ttdb_data.ENV.APP)
				{
					actionContainer = item.querySelector('div[class*="-DivActionItemContainer "][class^="tiktok-"]');
				} else if(data.env === ttdb_data.ENV.__NEXT)
				{
					actionContainer = item.querySelector('div[class*="-action-bar"].vertical');
				}

				if(!actionContainer)
				{
					return false;
				} else {
					actionContainer.prepend(button);
				}

				let videoDataOnSetup = ttdb_getVideoData(item, data);

				if(videoDataOnSetup.url && !button.ttIsProcessed)
				{
					setTimeout(() =>
					{
						button.style.opacity = 1;
					}, 50);

					/** Item has already loaded when being set up, so set up download button */
					ttdb_hookDownload(button, videoDataOnSetup);

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
								let videoData = ttdb_getVideoData(item, data);
			
								/** We have a valid video URL, so set download data */
								if(videoData.url && !button.ttIsProcessed)
								{
									/** Stop observing */
									observer.disconnect();

									setTimeout(() =>
									{
										button.style.opacity = 1;
									}, 50);

									/** Set up download button */
									ttdb_hookDownload(button, videoData);

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
		},
		/** Set up grid item */
		GRID: (item, data) =>
		{
			item.setAttribute('is-downloadable', 'true');

			/** Create download button */
			let button = ttdb_createButton.GRID();
	
			item.addEventListener('mouseenter', (e) =>
			{
				let videoData = ttdb_getVideoData(item, data);
		
				/**
				 * We have a valid video URL — set download data
				 */
				if(videoData.url && !button.ttIsProcessed)
				{
					ttdb_hookDownload(button, videoData);
					button.ttIsProcessed = true;
				}
			});
		
			ttdb_DOM.setStyle(item, {
				'position': 'relative'
			});
		
			item.appendChild(button);
		
			setTimeout(() =>
			{
				button.style.opacity = 1;
			}, 100);

			return true;
		},
		/** Set up browser item */
		BROWSER: (item, data) =>
		{
			let linkContainer = null;

			if(data.env === ttdb_data.ENV.APP)
			{
				linkContainer = item.querySelector('div[class*="-DivCopyLinkContainer "][class^="tiktok-"]');
			} else if(data.env === ttdb_data.ENV.__NEXT)
			{
				linkContainer = item.querySelector('div.video-infos-container > div.action-container');
			}

			if(linkContainer)
			{
				/** Mark container as handled */
				item.setAttribute('is-downloadable', 'true');

				/** Create download button */
				let button = ttdb_createButton.BROWSER();
				let videoData = ttdb_getVideoData(item, data);

				if(data.env === ttdb_data.ENV.APP)
				{
					linkContainer.before(button);
				} else if(data.env === ttdb_data.ENV.__NEXT)
				{
					linkContainer.after(button);
				}
				
				button.setAttribute('ttdb_mode', data.env === ttdb_data.ENV.__NEXT ? '__NEXT' : 'APP');

				ttdb_hookDownload(button, videoData);

				if(ttdb_data.observers.browserObserver)
				{
					ttdb_data.observers.browserObserver.disconnect();
				}

				let callback = (mutationsList, observer) =>
				{
					for(let mutation of mutationsList)
					{
						if(mutation.type === 'childList')
						{
							clearTimeout(ttdb_data.timers.browserObserver);
	
							ttdb_data.timers.browserObserver = setTimeout(() =>
							{
								ttdb_hookDownload(button, ttdb_getVideoData(item, data));
							}, 100);
						}
					}
				};

				ttdb_data.observers.browserObserver = new MutationObserver(callback);
	
				/** Observe any changes when navigating through items */
				ttdb_data.observers.browserObserver.observe(item, {
					childList: true,
					subtree: true
				});

				return true;
			}

			return false;
		}
	};
	
	/**
	 * Updates grid video items
	 */
	const ttdb_updateItems = () =>
	{
		let processed = 0;

		(ttdb_getVideoItems()).forEach((item) =>
		{
			let currentMode = null;
			let currentEnvironment = null;

			let modeElement = item.querySelector('div[mode]');

			if(modeElement)
			{
				currentMode = modeElement.getAttribute('mode');

				currentEnvironment = ttdb_data.ENV.APP;
			} else {
				let classList = item.classList;

				if(classList.contains('video-feed-item') || classList.contains('three-column-item'))
				{
					currentMode = ttdb_data.MODE.GRID;
				} else if(classList.contains('feed-item-content'))
				{
					currentMode = ttdb_data.MODE.FEED;
				} else if(classList.contains('browse-mode') || classList.contains('video-card-big'))
				{
					currentMode = ttdb_data.MODE.BROWSER;
				} else if(classList.contains('swiper-slide'))
				{
					currentMode = ttdb_data.MODE.SWIPER_SLIDE;
				}

				if(currentMode !== null)
				{
					currentEnvironment = ttdb_data.ENV.__NEXT;
				}
			}

			/** Set default environment if nothing has been detected */
			if(currentMode === null)
			{
				currentMode = ttdb_data.DEFAULT_ENV;
			}

			/** Data that we're sending downstream */
			let data = {
				mode: currentMode,
				env: currentEnvironment,
				container: item
			};

			if(currentMode === ttdb_data.MODE.FEED)
			{
				if(ttdb_setupItem.FEED(item, data))
				{
					processed++;
				}
			} else if(currentMode === ttdb_data.MODE.GRID)
			{
				if(ttdb_setupItem.GRID(item, data))
				{
					processed++;
				}
			} else if(currentMode === ttdb_data.MODE.BROWSER)
			{
				if(ttdb_setupItem.BROWSER(item, data))
				{
					processed++;
				}
			} else if(currentMode === ttdb_data.MODE.SWIPER_SLIDE)
			{
				if(ttdb_setupItem.SWIPER_SLIDE(item, data))
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
	const ttdb_updatePage = () =>
	{
		let processedItems = ttdb_updateItems();
	
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
		clearTimeout(ttdb_data.timers.scrollBreak);

		ttdb_data.timers.scrollBreak = setTimeout(() =>
		{
			ttdb_setInterval(20, 'DOCUMENT_SCROLL');
		}, 250);
	});
	
	/**
	 * Check for updates on `click`
	 */
	window.addEventListener('click', () =>
	{
		ttdb_setInterval(10, 'WINDOW_CLICK');
	});

	let observeApp = (container) =>
	{
		if(ttdb_data.observers.mainObserver)
		{
			ttdb_data.observers.mainObserver.disconnect();
		}

		let callback = (mutationsList, observer) =>
		{
			for(let mutation of mutationsList)
			{
				if(mutation.type === 'childList')
				{
					clearTimeout(ttdb_data.timers.appUpdated);

					ttdb_data.timers.appUpdated = setTimeout(() =>
					{
						ttdb_setInterval(15, 'APP_MUTATION');
					}, 500);
				}
			}
		};
		
		ttdb_data.observers.mainObserver = new MutationObserver(callback);
	
		ttdb_data.observers.mainObserver.observe(container, {
			childList: true,
			subtree: true
		});

		pipe('Watching for DOM changes ..');
	};

	let appContainer = ttdb_getAppContainer();

	if(appContainer)
	{
		observeApp(appContainer);
	} else {
		let checks = 0;

		ttdb_data.timers.appCreationWatcher = setInterval(() =>
		{
			appContainer = ttdb_getAppContainer();

			if(appContainer || checks === 10)
			{
				clearInterval(ttdb_data.timers.appCreationWatcher);

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
		if(ttdb_data.interval.counter > 0)
		{
			ttdb_updatePage();
			ttdb_data.interval.counter--;
		}
	}, ttdb_data.interval.delay);
})();