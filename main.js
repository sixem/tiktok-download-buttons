(() =>
{
	const ttdb_data = {};

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
	const ttdb_setInterval = (count) =>
	{
		if(ttdb_data.interval.counter < count)
		{
			ttdb_data.interval.counter = count
		}
	
		console.log('ttdb_setInterval', count);
	};

	/**
	 * Timers
	 */
	ttdb_data.timers = {};

	/**
	 * Different item modes
	 */
	ttdb_data.MODE = {
		BIG: '0',
		GRID: '1',
		BROWSER: '2'
	};

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
	
		fetch(url, ttdb_data.headers).then((t) =>
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
			});
		});
	};
	
	/**
	 * Sets the CSS style of an element
	 * 
	 * @param {HTMLElement} element 
	 * @param {object} values 
	 */
	const ttdb_setStyle = (element, values) =>
	{
		let keys = Object.keys(values);
	
		(keys).forEach((key) =>
		{
			element.style[key] = values[key];
		});
	};
	
	/**
	 * Base function for creating button elements
	 */
	const ttdb_newButton = (values) =>
	{
		let [contentMode, content] = values.content || ['textContent', 'Download'];
		let container = document.createElement('a');
		let span = document.createElement('span');
	
		span[contentMode] = content;
	
		container.appendChild(span);
		container.setAttribute('class', values.class || '');
	
		return container;
	};
	
	/**
	 * Creates different buttons for the different modes
	 */
	const ttdb_createButton = {
		/** Browser items (full-view items) */
		browser: () =>
		{
			let button = ttdb_newButton({
				content: ['textContent', 'Download'],
				class: 'ttdb__button_browser'
			});
	
			/** Set directly, as this makes it more compatible with dark mode addons */
			ttdb_setStyle(button, {
				'background-color': '#f1f1f2',
				'color': '#000'
			});
	
			return button;
		},
		/** Big items (feed items) */
		big: () =>
		{
			let button = ttdb_newButton({
				content: ['innerHTML', '&#10132;'],
				class: 'ttdb__button_action'
			});
	
			/** Set directly, as this makes it more compatible with dark mode addons */
			ttdb_setStyle(button, {
				'background-color': '#f1f1f2',
				'color': '#000'
			});
	
			return button;
		},
		/** Grid items (videos/liked items) */
		overlay: () =>
		{
			let button = ttdb_newButton({
				content: ['innerHTML', '&#10132;'],
				class: 'ttdb__button_overlay'
			});
	
			return button;
		}
	};
	
	/**
	 * Attempts to extract the description/tags to use as an ID
	 */
	const ttdb_extractDescriptionId = (container) =>
	{
		let descriptionElement = container.querySelector('span[class*="-SpanText "][class^="tiktok-"]');
		let identifier  = null;
	
		if(descriptionElement)
		{
			let descriptionContainer = descriptionElement.parentElement;
	
			/** We'll use the description/tags as the ID */
			let extracted = descriptionContainer.textContent.replace(/[/\\?%*:|"<>]/g, '-').toLowerCase().trim();
	
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
			/** Bigger items */
			if(data.mode === ttdb_data.MODE.BIG)
			{
				/** Get username */
				let itemUser = data.container.querySelector('a > [class*="AuthorTitle "][class^="tiktok-"]');
	
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
				let descriptionIdentifier = ttdb_extractDescriptionId(data.container);
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
					/** Get username */
					let itemUser = data.container.querySelector('div[class*="-DivInfoContainer "] a[href*="/@"]');
					videoData.user = itemUser ? itemUser.getAttribute('href').split('/@')[1] : 'tiktok_video' /** Fallback */;

					if(itemUser && videoData.user.includes('?'))
					{
						videoData.user = videoData.user.split('?')[0];
					}
	
					/** Get alternative id (no ID available here) */
					let descriptionIdentifier = ttdb_extractDescriptionId(data.container);
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
		let selectors = [
			'div[class*="-DivItemContainer "][class^="tiktok-"]:not([is-downloadable]):not([class*="-kdocy-"])',
			'div[class*="-DivBrowserModeContainer "][class^="tiktok-"]:not([is-downloadable])'
		];
	
		return document.querySelectorAll(selectors.join(', '));
	};

	const ttdb_hookDownload = (button, videoData) =>
	{
		let fileName = (videoData.id && videoData.user) ? `${videoData.user}-${videoData.id}` : Date.now();
	
		button.setAttribute('href', videoData.url);
		button.setAttribute('filename', `${fileName}.mp4`);
		button.setAttribute('download', fileName);
	
		button.addEventListener('click', (e) =>
		{
			/** Override default click behavior */
			e.preventDefault();
	
			/** Download file using this function instead */
			ttdb_downloadFile(videoData.url, `${fileName}.mp4`, e.target);
		});
	
		/** Download data has been set, make element interactable again */
		ttdb_setStyle(button, {
			'cursor': 'pointer',
			'pointer-events': 'auto'
		});
	
		return button;
	}

	const ttdb_setupItem = {
		/** Set up big item */
		big: (item, data) =>
		{
			let button = ttdb_createButton.big();
			let videoPreview = item.querySelector('div[class*="-DivContainer "][class^="tiktok-"] > img');
			let actionContainer = item.querySelector('div[class*="-DivActionItemContainer "][class^="tiktok-"]');
			
			if(videoPreview)
			{
				item.setAttribute('is-downloadable', 'true');
		
				actionContainer.prepend(button);
		
				let container = videoPreview.parentElement;
		
				let callback = (mutationsList, observer) =>
				{
					for(let mutation of mutationsList)
					{
						if(mutation.type === 'childList')
						{
							let videoData = ttdb_getVideoData(item, data);
		
							/**
							 * We have a valid video URL — set download data
							 */
							if(videoData.url && !button.ttIsProcessed)
							{
								setTimeout(() =>
								{
									button.style.opacity = 1;
								}, 50);
		
								observer.disconnect();
		
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
		},
		/** Set up grid item */
		grid: (item, data) =>
		{
			let button = ttdb_createButton.overlay();
	
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
		
			ttdb_setStyle(item, {
				'position': 'relative'
			});
		
			item.appendChild(button);
			item.setAttribute('is-downloadable', 'true');
		
			setTimeout(() =>
			{
				button.style.opacity = 1;
			}, 100);
		},
		/** Set up browser item */
		browser: (item, data) =>
		{
			let button = ttdb_createButton.browser();
			let videoData = ttdb_getVideoData(item, data);
			let linkContainer = item.querySelector('div[class*="-DivCopyLinkContainer "][class^="tiktok-"]');
		
			if(linkContainer)
			{
				linkContainer.before(button);
		
				if(linkContainer.parentElement && linkContainer.parentElement.children.length > 0)
				{
					let interactButtons = linkContainer.parentElement.children[0];
		
					ttdb_setStyle(interactButtons, {
						'margin-bottom': '10px'
					});
		
					if(interactButtons.children[0])
					{
						ttdb_setStyle(button, {
							'width': `${interactButtons.children[0].offsetWidth}px`
						});
					}
				}
		
				ttdb_hookDownload(button, videoData);
			}
		
			item.setAttribute('is-downloadable', 'true');
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
			let modeElement = item.querySelector('div[mode]');
	
			if(modeElement)
			{
				/**
				 * We need a way to differentiate between the different items
				 * The elements have a `mode` attribute, so we'll use that
				 * 
				 * 0 = Big items (For you page etc.)
				 * 1 = Grid items (Liked videos etc.)
				 * 2 = Opened items - full-view videos (Browser mode)
				 */
				let mode = modeElement.getAttribute('mode');
	
				/** Data that we're sending downstream */
				let data = {
					mode: mode,
					container: item
				};
	
				if(mode === ttdb_data.MODE.BIG)
				{
					ttdb_setupItem.big(item, data);
					processed++;
				} else if(mode === ttdb_data.MODE.GRID)
				{
					ttdb_setupItem.grid(item, data);
					processed++;
				} else if(mode === ttdb_data.MODE.BROWSER)
				{
					ttdb_setupItem.browser(item, data);
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
			console.log(`Processed ${processedItems} item(s)!`);
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
			ttdb_setInterval(25);
		}, 250);
	});
	
	/**
	 * Check for updates on `click`
	 */
	window.addEventListener('click', () =>
	{
		ttdb_setInterval(15);
	});
	
	window.addEventListener('DOMContentLoaded', () =>
	{
		let appContainer = document.querySelector('div#app');
	
		if(appContainer)
		{
			let callback = (mutationsList, observer) =>
			{
				for(let mutation of mutationsList)
				{
					if(mutation.type === 'childList')
					{
						clearTimeout(ttdb_data.timers.appUpdated);
	
						ttdb_data.timers.appUpdated = setTimeout(() =>
						{
							ttdb_setInterval(15);
						}, 500);
					}
				}
			};
			
			let observer = new MutationObserver(callback);
		
			observer.observe(appContainer, {
				childList: true,
				subtree: true
			});
		}
	});

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