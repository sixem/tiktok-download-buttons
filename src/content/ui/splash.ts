// Toast-style notifications for the content scripts.
import { SPLASH } from '../state';
import { DOM } from '../dom';

const DEFAULT_TOAST_ID = 'global';
const DEFAULT_META = 'Click to open downloads';

const getToastId = (options) => {
	if (options && options.id !== undefined && options.id !== null) {
		return String(options.id);
	}

	if (typeof SPLASH.toastCounter !== 'number') {
		SPLASH.toastCounter = 0;
	}

	SPLASH.toastCounter += 1;

	return `toast-${Date.now()}-${SPLASH.toastCounter}`;
};

const ensureWrapper = () => {
	if (SPLASH.wrapper) {
		return SPLASH.wrapper;
	}

	return SPLASH.create();
};

const updateWrapperState = () => {
	const wrapper = SPLASH.wrapper;
	if (!wrapper) return;

	const hasToasts = !!wrapper.querySelector('div.ttdb_splash-content');

	if (hasToasts) {
		wrapper.classList.add('is-active');
	} else {
		wrapper.classList.remove('is-active');
	}
};

const setToastState = (toast, state) => {
	toast.classList.remove('state-info', 'state-success', 'state-warn', 'state-error');

	if (state === 1) {
		toast.classList.add('state-success');
	} else if (state === 2) {
		toast.classList.add('state-warn');
	} else if (state === 3) {
		toast.classList.add('state-error');
	} else {
		toast.classList.add('state-info');
	}
};

const resolveToastPayload = (message, options) => {
	if (typeof message === 'string') {
		return {
			title: message,
			detail: options.detail || null,
			meta: options.meta || null,
			spinner: !!options.spinner
		};
	}

	if (message && typeof message === 'object') {
		return {
			title: message.title || '',
			detail: message.detail || null,
			meta: message.meta || null,
			spinner: typeof message.spinner === 'boolean' ? message.spinner : !!options.spinner
		};
	}

	return {
		title: '',
		detail: null,
		meta: null,
		spinner: !!options.spinner
	};
};

const ensureToastParts = (toast) => {
	let dot = toast.querySelector(':scope > span.toast__dot');
	let body = toast.querySelector(':scope > div.toast__body');

	if (!body) {
		body = document.createElement('div');
		body.classList.add('toast__body');
	}

	if (!dot) {
		dot = document.createElement('span');
		dot.classList.add('toast__dot');
	}

	if (!dot.parentElement) {
		if (body.parentElement) {
			toast.insertBefore(dot, body);
		} else {
			toast.appendChild(dot);
		}
	}

	if (!body.parentElement) {
		toast.appendChild(body);
	}

	let title = body.querySelector(':scope > div.toast__title');
	if (!title) {
		title = document.createElement('div');
		title.classList.add('toast__title');
		body.appendChild(title);
	}

	let detail = body.querySelector(':scope > div.toast__detail');
	if (!detail) {
		detail = document.createElement('div');
		detail.classList.add('toast__detail');
		body.appendChild(detail);
	}

	let meta = body.querySelector(':scope > div.toast__meta');
	if (!meta) {
		meta = document.createElement('div');
		meta.classList.add('toast__meta');
		body.appendChild(meta);
	}

	let spinner = toast.querySelector(':scope > span.toast__spinner');
	if (!spinner) {
		spinner = document.createElement('span');
		spinner.classList.add('toast__spinner');
		toast.appendChild(spinner);
	}

	return { dot, body, title, detail, meta, spinner };
};

const setToastContent = (toast, payload) => {
	toast.classList.toggle('has-spinner', payload.spinner);
	const parts = ensureToastParts(toast);

	parts.title.textContent = payload.title || '';

	if (payload.detail) {
		parts.detail.textContent = payload.detail;
		parts.detail.style.display = '';
	} else {
		parts.detail.textContent = '';
		parts.detail.style.display = 'none';
	}

	if (payload.meta) {
		parts.meta.textContent = payload.meta;
		parts.meta.style.display = '';
	} else {
		parts.meta.textContent = '';
		parts.meta.style.display = 'none';
	}

	parts.spinner.style.display = payload.spinner ? '' : 'none';
};

const clearToastTimer = (toastId) => {
	if (!SPLASH.timers || !SPLASH.timers.has(toastId)) return;

	clearTimeout(SPLASH.timers.get(toastId));
	SPLASH.timers.delete(toastId);
};

const hideToast = (toastId, toast, callback = null) => {
	clearToastTimer(toastId);

	toast.classList.remove('is-visible');

	setTimeout(() => {
		toast.remove();

		if (SPLASH.toasts) {
			SPLASH.toasts.delete(toastId);
		}

		updateWrapperState();

		if (callback) {
			callback();
		}
	}, 220);
};

const scheduleHide = (toastId, toast, duration, callback = null) => {
	clearToastTimer(toastId);

	if (duration <= 0) return;

	if (!SPLASH.timers) {
		SPLASH.timers = new Map();
	}

	const timer = setTimeout(() => hideToast(toastId, toast, callback), duration);
	SPLASH.timers.set(toastId, timer);
};

const ensureToast = (toastId) => {
	if (!SPLASH.toasts) {
		SPLASH.toasts = new Map();
	}

	const existing = SPLASH.toasts.get(toastId);
	if (existing) {
		return existing;
	}

	const wrapper = ensureWrapper();
	if (!wrapper) return null;

	const toast = document.createElement('div');
	toast.classList.add('ttdb_splash-content');
	toast.dataset.toastId = toastId;
	toast.textContent = '';

	toast.addEventListener('click', () => {
		chrome.runtime.sendMessage(chrome.runtime.id, {
			task: 'fileShow'
		});
	});

	wrapper.prepend(toast);
	SPLASH.toasts.set(toastId, toast);

	return toast;
};

export const setupSplash = () => {
	SPLASH.create = () => {
		const body = document.body;
		const wrapper = document.createElement('div');

		wrapper.classList.add('ttdb_splash-wrapper');
		wrapper.textContent = '';

		if (body) {
			body.appendChild(wrapper);

			SPLASH.wrapper = wrapper;
			SPLASH.toasts = new Map();
			SPLASH.timers = new Map();
			SPLASH.toastCounter = 0;
		}

		return wrapper;
	};

	SPLASH.message = (message, options = {}, callback = null) => {
		const wrapper = ensureWrapper();
		if (!wrapper) return false;

		const toastId = getToastId(options);
		const toast = ensureToast(toastId);

		if (!toast) return false;

		const state = typeof options.state === 'number' ? options.state : 0;
		setToastState(toast, state);
		const payload = resolveToastPayload(message, options);
		payload.meta = options.hideMeta ? null : (payload.meta || DEFAULT_META);
		setToastContent(toast, payload);

		updateWrapperState();

		if (!toast.classList.contains('is-visible')) {
			requestAnimationFrame(() => {
				toast.classList.add('is-visible');
			});
		}

		const duration = options.sticky
			? 0
			: (typeof options.duration === 'number' ? options.duration : 4200);

		scheduleHide(toastId, toast, duration, callback);

		return true;
	};

	SPLASH.dismiss = (toastId = DEFAULT_TOAST_ID) => {
		if (!SPLASH.toasts || !SPLASH.toasts.size) return;

		const resolvedId = String(toastId);
		const toast = SPLASH.toasts.get(resolvedId);

		if (toast) {
			hideToast(resolvedId, toast);
		}
	};

	return SPLASH;
};
