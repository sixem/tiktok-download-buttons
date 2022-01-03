/**
 * Downloads a file
 * 
 * @param {string} url 
 * @param {string} filename 
 */
const downloadFile = (url, filename, buttonElement = null) =>
{
	if(buttonElement)
	{
		buttonElement.style.cursor = 'progress';
	}

	fetch(url, {
		method: 'GET',
		mode: 'cors',
		cache: 'no-cache',
		credentials: 'same-origin',
		redirect: 'follow'
	}).then((t) =>
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
 * @param {HTMLElement} element 
 * @param {object} values 
 */
const setStyle = (element, values) =>
{
	let keys = Object.keys(values);

	(keys).forEach((key) =>
	{
		element.style[key] = values[key];
	});
};

/**
 * Creates a browser item download button
 */
 const createBrowserDownloadButton = () =>
 {
	 let container = document.createElement('a');
	 let span = document.createElement('span');
 
	 span.textContent = 'Download';
 
	 container.appendChild(span);
	 container.setAttribute('class', 'tiktok-browser-download-button');

	 setStyle(container, {
		'background-color': '#f1f1f2',
		'color': '#000'
	});
 
	 return container;
 };

/**
 * Creates an action item download button (larger items)
 */
const createActionDownloadButton = () =>
{
	let container = document.createElement('a');
	let span = document.createElement('span');

	span.innerHTML = '&#10132;';

	container.appendChild(span);
	container.setAttribute('class', 'tiktok-action-download-button');

	return container;
};

/**
 * Creates an overlay download button (grid items)
 */
const createOverlayDownloadButton = () =>
{
	let container = document.createElement('a');

	container.innerHTML = '&#10132;';
	container.setAttribute('class', 'tiktok-download-button');

	return container;
};

/**
 * Attempts to extract the description/tags to use as an ID
 */
const extractDescriptionId = (container) =>
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
const getVideoData = (container, data = {}) =>
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
		if(data.mode === '0')
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
				}
			}

			/** Get alternative id (no ID available here) */
			let descriptionIdentifier = extractDescriptionId(data.container);
			videoData.id = descriptionIdentifier ? descriptionIdentifier : Date.now() /** Fallback */;
		/** Grid items */
		} else if(data.mode === '1')
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
		} else if(data.mode === '2')
		{
			if(!videoData.id || !videoData.user)
			{
				/** Get username */
				let itemUser = data.container.querySelector('div[class*="-DivInfoContainer "] a[href*="/@"]');
				videoData.user = itemUser ? itemUser.getAttribute('href').split('/@')[1] : 'tiktok_video' /** Fallback */;

				/** Get alternative id (no ID available here) */
				let descriptionIdentifier = extractDescriptionId(data.container);
				videoData.id = descriptionIdentifier ? descriptionIdentifier : Date.now() /** Fallback */;
			}
		}

		/** Get actual video download URL */
		videoData.url = videoElement.getAttribute('src');
	}

	console.log(data, videoData);

	return videoData;
};

/**
 * Fetches video items
 */
const getVideoItems = () =>
{
	let selectors = [
		'div[class*="-DivItemContainer "][class^="tiktok-"]:not([is-downloadable]):not([class*="-kdocy-"])',
		'div[class*="-DivBrowserModeContainer "][class^="tiktok-"]:not([is-downloadable])'
	];

	return document.querySelectorAll(selectors.join(', '));
};

const setupDownloadButton = (downloadElement, videoData) =>
{
	let fileName = (videoData.id && videoData.user) ? `${videoData.user}-${videoData.id}` : Date.now();

	downloadElement.setAttribute('href', videoData.url);
	downloadElement.setAttribute('filename', `${fileName}.mp4`);
	downloadElement.setAttribute('download', fileName);

	downloadElement.addEventListener('click', (e) =>
	{
		/** Override default click behavior with .. */
		e.preventDefault();

		/** .. This! */
		downloadFile(videoData.url, `${fileName}.mp4`, e.target);
	});

	/** Download data has been set, make element interactable again */
	setStyle(downloadElement, {
		'cursor': 'pointer',
		'pointer-events': 'auto'
	});

	return downloadElement;
}

/**
 * Updates big video items
 */
const setupBigItem = (item, data) =>
{
	let downloadElement = createActionDownloadButton();
	let videoPreview = item.querySelector('div[class*="-DivContainer "][class^="tiktok-"] > img');
	let actionContainer = item.querySelector('div[class*="-DivActionItemContainer "][class^="tiktok-"]');
	
	if(videoPreview)
	{
		item.setAttribute('is-downloadable', 'true');

		actionContainer.prepend(downloadElement);

		let container = videoPreview.parentElement;

		const callback = (mutationsList, observer) =>
		{
			for(let mutation of mutationsList)
			{
				if(mutation.type === 'childList')
				{
					let videoData = getVideoData(item, data);

					/**
					 * We have a valid video URL — set download data
					 */
					if(videoData.url && !downloadElement.ttIsProcessed)
					{
						setTimeout(() =>
						{
							downloadElement.style.opacity = 1;
						}, 50);

						observer.disconnect();

						setupDownloadButton(downloadElement, videoData);
						downloadElement.ttIsProcessed = true;
					}
				}
			}
		};
		
		const observer = new MutationObserver(callback);

		observer.observe(container, {
			childList: true,
			subtree: true
		});
	}
};

const setupGridItem = (item, data) =>
{
	let downloadElement = createOverlayDownloadButton();

	item.addEventListener('mouseenter', (e) =>
	{
		let videoData = getVideoData(item, data);

		/**
		 * We have a valid video URL — set download data
		 */
		if(videoData.url && !downloadElement.ttIsProcessed)
		{
			setupDownloadButton(downloadElement, videoData);
			downloadElement.ttIsProcessed = true;
		}
	});

	setStyle(item, {
		'position': 'relative'
	});

	item.appendChild(downloadElement);
	item.setAttribute('is-downloadable', 'true');

	setTimeout(() =>
	{
		downloadElement.style.opacity = 1;
	}, 100);
};

const setupBrowserItem = (item, data) =>
{
	let downloadElement = createBrowserDownloadButton();
	let videoData = getVideoData(item, data);
	let linkContainer = item.querySelector('div[class*="-DivCopyLinkContainer "][class^="tiktok-"]');

	if(linkContainer)
	{
		linkContainer.before(downloadElement);

		if(linkContainer.parentElement && linkContainer.parentElement.children.length > 0)
		{
			let interactButtons = linkContainer.parentElement.children[0];

			setStyle(interactButtons, {
				'margin-bottom': '10px'
			});

			if(interactButtons.children[0])
			{
				setStyle(downloadElement, {
					'width': `${interactButtons.children[0].offsetWidth}px`
				});
			}
		}

		setupDownloadButton(downloadElement, videoData);
	}

	item.setAttribute('is-downloadable', 'true');
};

/**
 * Updates grid video items
 */
const updateItems = () =>
{
	let processed = 0;

	(getVideoItems()).forEach((item) =>
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
			 * 2 = Opened items, fully in-focus videos (Browser mode)
			 */
			let mode = modeElement.getAttribute('mode');

			/** Data that we're sending downstream */
			let data = {
				mode: mode,
				container: item
			};

			if(mode === '0')
			{
				setupBigItem(item, data);
				processed++;
			} else if(mode === '1')
			{
				setupGridItem(item, data);
				processed++;
			} else if(mode === '2')
			{
				setupBrowserItem(item, data);
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
	let gridItemsUpdated = updateItems();
	let processedItems = gridItemsUpdated;

	if(processedItems > 0)
	{
		console.log(`Processed ${processedItems} item(s)!`);
	}
};

const interval = {
	counter: 50
};

setInterval(() =>
{
	if(interval.counter > 0)
	{
		updatePage();
		interval.counter--;
	}
}, 250);

document.addEventListener('scroll', (e) =>
{
	if(interval.counter < 25)
	{
		interval.counter = 25
	}
});

window.addEventListener('click', (e) =>
{
	if(interval.counter < 15)
	{
		interval.counter = 15;
	}
});