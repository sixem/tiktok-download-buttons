// Firefox download executor.
//
// Firefox starts downloads directly from the service worker and uses an in-page
// fetch->blob retry when the browser reports SERVER_FORBIDDEN.

import { sendRuntimeMessage } from '../utils/extension';
import type { DownloadMethodTag } from './download-method';
import { registerPendingDownloadSession } from './session-store';
import type { DownloadToastPresenter } from './toast-presenter';
import {
	executeInPageFetchBlobFallback,
	formatChainedMethodTag
} from './in-page-fetch-fallback';

export const executeFirefoxDownload = async ({
	url,
	filename,
	subFolder,
	toastId,
	methodTag,
	attemptLabel,
	toastPresenter,
	logDownload
}: {
	url: string;
	filename: string;
	subFolder: string;
	toastId: string;
	methodTag: DownloadMethodTag | null;
	attemptLabel: string;
	toastPresenter: DownloadToastPresenter;
	logDownload: any;
}) => {
	let response: any = null;
	try {
		response = await sendRuntimeMessage({
			task: 'fileDownload',
			url,
			filename,
			subFolder
		});
	} catch (error) {
		logDownload.warn(`Attempt ${attemptLabel}: download request failed`, error);
		toastPresenter.showBlockedNoTabFallback();
		return;
	}

	if (response && response.success && typeof response.itemId === 'number') {
		registerPendingDownloadSession({
			itemId: response.itemId,
			session: {
				objectUrl: null,
				startedAtMs: Date.now(),
				toastId,
				filename,
				sourceTag: methodTag,
				originalUrl: url,
				hasRetried: false
			}
		});

		logDownload.info(`Attempt ${attemptLabel}: download started`, {
			url,
			itemId: response.itemId
		});

		toastPresenter.showDownloadStartedInBrowser();
		return;
	}

	logDownload.warn(`Attempt ${attemptLabel}: download failed`, response);

	const chainedTag = formatChainedMethodTag(methodTag || null, 'BLOB');
	const inPageStarted = await executeInPageFetchBlobFallback({
		url,
		filename,
		toastPresenter,
		toastTag: chainedTag,
		sourceTag: methodTag || null,
		probeMode: 'video-content-type',
		logDownload,
		showFailureToast: false
	});

	if (!inPageStarted) {
		logDownload.warn(`Attempt ${attemptLabel}: download blocked (no tab fallback)`);
		toastPresenter.showBlockedNoTabFallback();
	}
};
