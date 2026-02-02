import { SPLASH, TTDB } from '../state';
import { DOM } from '../dom';

export const setupSplash = () => {
	SPLASH.create = () => {
		const body = document.body;

		const wrapper = document.createElement('div');
		const content = document.createElement('div');

		wrapper.classList.add('ttdb_splash-wrapper');
		content.classList.add('ttdb_splash-content');
		content.textContent = '';

		wrapper.appendChild(content);

		if (body) {
			body.appendChild(wrapper);

			SPLASH.wrapper = wrapper;
			SPLASH.content = content;

			SPLASH.content.addEventListener('click', () => {
				chrome.runtime.sendMessage(chrome.runtime.id, {
					task: 'fileShow'
				});
			});
		}

		return wrapper;
	};

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
				opacity: 1,
				'pointer-events': 'auto'
			});

			TTDB.timers.splash = setTimeout(() => {
				DOM.setStyle(SPLASH.wrapper, {
					opacity: 0,
					'pointer-events': 'none'
				});

				if (callback) {
					callback();
				}
			}, options.duration || 3000);

			return true;
		}
	};

	return SPLASH;
};

