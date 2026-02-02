import { ACTIVE } from '../state';
import { DOM } from '../dom';

export const setupActiveDownloads = () => {
	ACTIVE.hash = (input) => {
		return input.split('').reduce((hash, char) => (hash * 33) ^ char.charCodeAt(0), 5381) >>> 0;
	};

	ACTIVE.create = () => {
		if (document.body) {
			const container = document.createElement('div');

			container.classList.add('ttdb_downloading-active');
			container.textContent = '';

			document.body.appendChild(container);

			return container;
		}
	};

	ACTIVE.getContainer = () => {
		const container = document.body.querySelector('div.ttdb_downloading-active');
		return container ? container : ACTIVE.create();
	};

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
	};

	ACTIVE.refreshUi = () => {
		const activeHashes = Object.keys(ACTIVE.running);
		const container = ACTIVE.getContainer();

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

	ACTIVE.ping = (item) => {
		const hash = ACTIVE.hash(item.id);

		if (!ACTIVE.running.hasOwnProperty(hash) && item.percentage === 0) {
			ACTIVE.running[hash] = {
				item,
				timeout: setTimeout(() => ACTIVE.remove(hash), 1E4)
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

	return ACTIVE;
};

