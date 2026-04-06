// Chromium direct-blob executor.
//
// For page-owned blob: URLs, let the page trigger the download and use
// `downloads.onDeterminingFilename` in the service worker to inject the
// configured subfolder path.

import { sendRuntimeMessage } from '../utils/extension';
import type { DownloadMethodTag } from './download-method';
import type { DownloadToastPresenter } from './toast-presenter';

const attemptBlobAnchorDownload = (blobUrl: string, filename: string) => {
	try {
		const anchor = document.createElement('a');
		anchor.href = blobUrl;
		anchor.download = filename || 'video.mp4';
		anchor.style.display = 'none';

		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();

		return true;
	} catch (_) {
		return false;
	}
};

export const executeChromiumBlobDownload = async ({
	url,
	originalUrl,
	filename,
	subFolder,
	toastId,
	methodTag,
	attemptLabel,
	toastPresenter,
	logDownload
}: {
	url: string;
	originalUrl?: string;
	filename: string;
	subFolder: string;
	toastId: string;
	methodTag: DownloadMethodTag | null;
	attemptLabel: string;
	toastPresenter: DownloadToastPresenter;
	logDownload: any;
}) => {
	let arm: any = null;

	try {
		arm = await sendRuntimeMessage({
			task: 'armBlobSuggest',
			blobUrl: url,
			originalUrl: typeof originalUrl === 'string' && originalUrl.length > 0 ? originalUrl : url,
			filename,
			subFolder,
			toastId,
			sourceTag: methodTag
		});
	} catch (error) {
		logDownload.warn(`Attempt ${attemptLabel}: blob suggest arm failed`, error);
	}

	const armed = !!(
		arm
		&& arm.success
		&& typeof arm.token === 'string'
		&& typeof arm.tempName === 'string'
	);

	if (!armed) {
		const started = attemptBlobAnchorDownload(url, filename || 'video.mp4');
		logDownload.info(`Attempt ${attemptLabel}: chromium blob anchor ${started ? 'triggered' : 'failed'}`, {
			armed: false
		});
		toastPresenter.showInPageFetchResult({
			started,
			tag: 'BLOB'
		});
		return;
	}

	const started = attemptBlobAnchorDownload(url, arm.tempName);
	logDownload.info(`Attempt ${attemptLabel}: chromium blob anchor ${started ? 'triggered' : 'failed'}`, {
		armed: true
	});

	if (!started) {
		toastPresenter.showInPageFetchResult({
			started: false,
			tag: 'BLOB'
		});
		return;
	}

	toastPresenter.showDownloadStartedInBrowser();
};
