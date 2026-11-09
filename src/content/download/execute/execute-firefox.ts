// Firefox download executor.
//
// Firefox starts downloads directly from the service worker and uses an in-page
// fetch->blob retry when the browser reports SERVER_FORBIDDEN.

import { sendRuntimeMessage } from '@/content/utils';
import { registerPendingDownloadSession } from '@/content/download/state/session-store';
import type { DownloadToastPresenter } from '@/content/download/ui/toast-presenter';
import {
	executeInPageFetchBlobFallback,
	formatChainedDownloadTag
} from '@/content/download/execute/in-page-fetch-fallback';
import type { DownloadTag } from '@/types';

export const executeFirefoxDownload = async ({
	url,
	filename,
	subFolder,
	pageUrl,
	toastId,
	sourceTag,
	attemptLabel,
	toastPresenter,
	logDownload
}: {
	url: string;
	filename: string;
	subFolder: string;
	pageUrl: string | null;
	toastId: string;
	sourceTag: DownloadTag;
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
			subFolder,
			referer: pageUrl
		});
	} catch (error) {
		logDownload.warn(`Attempt ${attemptLabel}: download request failed`, error);
		toastPresenter.showBlockedNoTabFallback();
		return;
	}

	if (response?.success && typeof response.itemId === 'number') {
		registerPendingDownloadSession({
			itemId: response.itemId,
			session: {
				objectUrl: null,
				startedAtMs: Date.now(),
				toastId,
				filename,
				sourceTag,
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

	const chainedTag = formatChainedDownloadTag(sourceTag, 'BLOB');
	const inPageStarted = await executeInPageFetchBlobFallback({
		url,
		filename,
		toastPresenter,
		toastTag: chainedTag,
		sourceTag,
		probeMode: 'video-content-type',
		logDownload
	});

	if (!inPageStarted) {
		logDownload.warn(`Attempt ${attemptLabel}: download blocked (no tab fallback)`);
		toastPresenter.showBlockedNoTabFallback();
	}
};
