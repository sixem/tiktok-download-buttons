// Popup UI logic for extension settings.
import './popup.scss';
import { storageGet, storageSet } from '@/popup-utils';
import { TTDB_OPTIONS, type TTDBOptionKey } from '@/options';

const normalizeSubfolderPath = (value: string) => {
	return value
		.trim()
		.replace(/\\/g, '/') // Replace `\` with `/`
		.replace(/\/+/g, '/') // Remove duplicate slashes
		.replace(/^\//, ''); // Remove leading slashes
};

const normalizeNamingTemplate = (value: string) => value.trim();

const getInputElement = (id: TTDBOptionKey) => {
	const el = document.querySelector<HTMLInputElement>(`input#${id}`);
	return el ?? null;
};

window.addEventListener('DOMContentLoaded', async () => {
	const manifest = chrome.runtime.getManifest();

	const versionElement = document.querySelector('#version');
	const repoLinkElements = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-repo-link]'));
	const issuesLinkElements = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-issues-link]'));

	if(versionElement) {
		versionElement.textContent = manifest.version;
		versionElement.style.visibility = 'visible';
	}

	if (typeof manifest.homepage_url === 'string' && manifest.homepage_url.length > 0) {
		const repoUrl = manifest.homepage_url.replace(/\/+$/, '');
		const issuesUrl = /github\.com\/[^/]+\/[^/]+/i.test(repoUrl) ? `${repoUrl}/issues` : repoUrl;

		for (const el of repoLinkElements) {
			el.setAttribute('href', repoUrl);
		}

		for (const el of issuesLinkElements) {
			el.setAttribute('href', issuesUrl);
		}
	}

	// The popup is ephemeral, but an explicit close button makes it feel more "app-like"
	// (and reduces the need to click outside of the popup to dismiss it).
	const closeButton = document.querySelector<HTMLButtonElement>('[data-close-popup]');
	closeButton?.addEventListener('click', () => window.close());

	const popupRoot = document.querySelector<HTMLElement>('.popup');
	const resetModal = document.querySelector<HTMLElement>('[data-reset-modal]');
	const openResetButton = document.querySelector<HTMLButtonElement>('[data-open-reset]');
	const cancelResetButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-reset-cancel]'));
	const confirmResetButton = document.querySelector<HTMLButtonElement>('[data-reset-confirm]');
	const buttonSave = document.querySelector<HTMLButtonElement>('#settings-save');

	const setResetModalOpen = (isOpen: boolean) => {
		if (!popupRoot || !resetModal) return;

		popupRoot.classList.toggle('popup--modalOpen', isOpen);

		// Prefer the DOM property over `toggleAttribute()` so the intent is obvious
		// and we don't depend on relatively new DOM APIs.
		resetModal.hidden = !isOpen;
	};

	// Ensure the modal starts closed, even if the markup gets edited in the future.
	setResetModalOpen(false);

	openResetButton?.addEventListener('click', () => setResetModalOpen(true));
	for (const el of cancelResetButtons) {
		el.addEventListener('click', () => setResetModalOpen(false));
	}

	// Load existing settings into the UI (and backfill defaults if needed).
	const optionKeys = Object.keys(TTDB_OPTIONS) as TTDBOptionKey[];

	let stored: Record<string, unknown> = {};
	try {
		stored = await storageGet(optionKeys) as Record<string, unknown>;
	} catch (error) {
		console.warn('[TTDB]', 'Failed to read settings from storage', error);
	}

	for (const key of optionKeys) {
		const input = getInputElement(key);
		if (!input) continue;

		const schema = TTDB_OPTIONS[key];
		const rawValue = stored ? stored[key] : undefined;

		if (schema.type !== 'text') continue;

		const value = typeof rawValue === 'string' ? rawValue : String(schema.default ?? '');
		input.value = value;

		// If the stored value is missing/invalid, write the default so other parts of the
		// extension don't need to special-case `undefined`/`false`.
		if (typeof rawValue !== 'string') {
			await storageSet({ [key]: value });
		}
	}

	buttonSave?.addEventListener('click', async () => {
		const subfolderEl = getInputElement('download-subfolder-path');
		const namingEl = getInputElement('download-naming-template');

		const subfolder = subfolderEl ? normalizeSubfolderPath(subfolderEl.value) : String(TTDB_OPTIONS['download-subfolder-path'].default ?? '');

		const namingTemplateRaw = namingEl ? normalizeNamingTemplate(namingEl.value) : '';
		const namingTemplate = namingTemplateRaw.length > 0
			? namingTemplateRaw
			: String(TTDB_OPTIONS['download-naming-template'].default ?? '');

		await storageSet({
			'download-subfolder-path': subfolder,
			'download-naming-template': namingTemplate
		});

		window.close();
	});

	confirmResetButton?.addEventListener('click', async () => {
		const resetPayload: Record<string, unknown> = {};
		for (const key of optionKeys) {
			resetPayload[key] = TTDB_OPTIONS[key].default;

			const input = getInputElement(key);
			if (input && TTDB_OPTIONS[key].type === 'text') {
				input.value = String(TTDB_OPTIONS[key].default ?? '');
			}
		}

		await storageSet(resetPayload);

		setResetModalOpen(false);
	});

	// Let Escape dismiss the reset confirmation (when it is open).
	window.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape') return;
		if (!popupRoot?.classList.contains('popup--modalOpen')) return;
		event.preventDefault();
		setResetModalOpen(false);
	});
});
