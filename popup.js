const getOptions = async () => {
	return await chrome.runtime.sendMessage(
		chrome.runtime.id, {
			task: 'optionsGet'
		}
	);
}

window.addEventListener('DOMContentLoaded', async () => {
	const manifest = chrome.runtime.getManifest();

	const versionElement = document.querySelector('body > div#version');
	const websiteElement = document.querySelector('body > a#website');

	if(versionElement) {
		versionElement.textContent = manifest.version;
		versionElement.style.visibility = 'visible';
	}

	if(websiteElement) {
		websiteElement.setAttribute('href', manifest.homepage_url);
		websiteElement.style.visibility = 'visible';
	}

	const options = await getOptions();

	Object.keys(options).forEach((key) => {
		// Handle toggleable options (checkboxes)
		if(options[key].type === 'toggle') {
			const element = document.querySelector(`input[type="checkbox"]#${key}`);

			chrome.storage.local.get(key, (result) => {
				let currentValue = result[key];

				// If value has not been set already, set to default
				if(!(currentValue === true || currentValue === false)) {
					let newValue = new Object();
					newValue[key] = options[key].default;
					chrome.storage.local.set(newValue);
				} else {
					element.checked = currentValue;
				}
			});

			element.addEventListener('change', (e) => {
				options[key].current = e.target.checked ? true : false;
			});
		// Handle text input (textboxes)
		} else if (options[key].type === 'text') {
			const element = document.querySelector(`input[type="text"]#${key}`);

			chrome.storage.local.get(key, (result) => {
				let currentValue = result[key];

				// If value has not been set already, set to default
				if(currentValue === false) {
					let newValue = new Object();
					newValue[key] = options[key].default;
					chrome.storage.local.set(newValue);
				} else if(typeof currentValue === 'string' || currentValue instanceof String) {
					element.value = currentValue;
				}
			});

			/** Detect checked change */
			(['change', 'keydown', 'paste', 'input']).forEach((event) => {
				element.addEventListener(event, (e) => {
					let newValue = e.target.value.trim()
						.replace(/\\/g, '/') // Replace `\` with `/`
						.replace(/\/+/g, '/') // Remove duplicate slashes
						.replace(/^\//, ''); // Remove leading slashes

					options[key].current = newValue;
				});
			});
		}
	});

	const buttonSave = document.querySelector('body > button#settings-save');

	buttonSave.addEventListener('click', async () => {
		Object.keys(options).forEach(async (key) => {
			if(options[key].current !== null) {
				let value = new Object();
				value[key] = options[key].current;
				await chrome.storage.local.set(value);
			}
		}); window.close();
	});
});