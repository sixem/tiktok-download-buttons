/** Options getter */
const getOptions = async () =>
{
	return await chrome.runtime.sendMessage(
		chrome.runtime.id, {
			task: 'optionsGet'
		});
}

/** Fired upon DOM load */
window.addEventListener('DOMContentLoaded', async () =>
{
	let manifest = chrome.runtime.getManifest();

	let versionElement = document.querySelector('body > div#version');
	let websiteElement = document.querySelector('body > a#website');

	if(versionElement)
	{
		versionElement.textContent = manifest.version;
		versionElement.style.visibility = 'visible';
	}

	if(websiteElement)
	{
		websiteElement.setAttribute('href', manifest.homepage_url);
		websiteElement.style.visibility = 'visible';
	}

	let options = await getOptions();

	Object.keys(options).forEach((key) =>
	{
		/** Handle toggleable options (checkboxes) */
		if(options[key].type === 'toggle')
		{
			let element = document.querySelector(`input[type="checkbox"]#${key}`);

			chrome.storage.local.get(key, (result) =>
			{
				let currentValue = result[key];

				/** If value has not been set already, set to default */
				if(!(currentValue === true || currentValue === false))
				{
					let newValue = new Object();
					newValue[key] = options[key].default;

					chrome.storage.local.set(newValue);
				} else {
					element.checked = currentValue;
				}
			});

			/** Detect checked change */
			element.addEventListener('change', (e) =>
			{
				options[key].current = e.target.checked ? true : false;
			});
		/** Handle text input (textboxes) */
		} else if(options[key].type === 'text')
		{
			let element = document.querySelector(`input[type="text"]#${key}`);

			chrome.storage.local.get(key, (result) =>
			{
				let currentValue = result[key];

				/** If value has not been set already, set to default */
				if(currentValue === false)
				{
					let newValue = new Object();
					newValue[key] = options[key].default;

					chrome.storage.local.set(newValue);
				} else if(typeof currentValue === 'string'
					|| currentValue instanceof String)
				{
					element.value = currentValue;
				}
			});

			/** Detect checked change */
			(['change', 'keydown', 'paste', 'input']).forEach((event) =>
			{
				element.addEventListener(event, (e) =>
				{
					let newValue = e.target.value.trim()
					.replace(/\\/g, '/') /** Replace `\` with `/` */
					.replace(/\/+/g, '/') /** Remove duplicate slashes */
					.replace(/^\//, ''); /** Remove leading slashes */

					options[key].current = newValue;
				});
			});
		}
	});

	let buttonSave = document.querySelector('body > button#settings-save');

	/** Detect save button click */
	buttonSave.addEventListener('click', async () =>
	{
		Object.keys(options).forEach(async (key) =>
		{
			if(options[key].current !== null)
			{
				let value = new Object();
				
				value[key] = options[key].current;

				await chrome.storage.local.set(value);
			}
		});

		let storedManifest = await chrome.storage.local.get('manifest');

		/** Reset API manifest attempt timestamp on save */
		if(storedManifest &&
			storedManifest.manifest)
		{
			await chrome.storage.local.set({
				manifest: {
					working: storedManifest.manifest.working,
					updated: 0
				}
			});
		}

		window.close();
	});
});