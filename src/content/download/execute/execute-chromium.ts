// Chromium download executor.
//
// Chromium probes the URL in-page, then hands an object URL to the service worker
// so the browser can complete the download without a second network request.

import { TTDB, UTIL } from '@/content/core/state';
import { sendRuntimeMessage } from '@/content/utils';
import { CHROMIUM_DOWNLOAD } from '@/content/download/constants';
import type { DownloadMethodTag } from '@/content/download/flow/download-method';
import { registerPendingDownloadSession } from '@/content/download/state/session-store';
import type { DownloadToastPresenter } from '@/content/download/ui/toast-presenter';

const revokeObjectUrl = (objectUrl: string) => {
	try {
		URL.revokeObjectURL(objectUrl);
	} catch (_) {
		// Best-effort cleanup.
	}
};

export const executeChromiumDownload = async ({
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
	try {
		const probeResponse = await fetch(url, TTDB.headers);
		if (!UTIL.validateVideoRequest(probeResponse) || !probeResponse.body) {
			logDownload.warn(
				`Attempt ${attemptLabel}: probe failed (${probeResponse.headers.get('Content-Type') || ''} - ${probeResponse.status})`,
				probeResponse
			);
			logDownload.warn(`Attempt ${attemptLabel}: download blocked (no tab fallback)`);
			toastPresenter.showBlockedNoTabFallback();
			return;
		}

		logDownload.info(`Attempt ${attemptLabel}: probe valid`, probeResponse);

		const responseBlob = await probeResponse.blob();
		const objectUrl = URL.createObjectURL(responseBlob);

		let response: any = null;
		try {
			response = await sendRuntimeMessage({
				task: 'fileDownload',
				url: objectUrl,
				filename,
				subFolder
			});
		} catch (error) {
			logDownload.warn(`Attempt ${attemptLabel}: download request failed`, error);
			revokeObjectUrl(objectUrl);
			logDownload.warn(`Attempt ${attemptLabel}: download blocked (no tab fallback)`);
			toastPresenter.showBlockedNoTabFallback();
			return;
		}

		if (response && response.success && typeof response.itemId === 'number') {
			registerPendingDownloadSession({
				itemId: response.itemId,
				session: {
					objectUrl,
					startedAtMs: Date.now(),
					toastId,
					filename,
					sourceTag: methodTag,
					originalUrl: url,
					hasRetried: false
				},
				safetyTimeoutMs: CHROMIUM_DOWNLOAD.safetyRevokeMs
			});

			logDownload.info(`Attempt ${attemptLabel}: download started`, {
				url,
				itemId: response.itemId
			});

			toastPresenter.showDownloadStartedInBrowser();
			return;
		}

		logDownload.warn(`Attempt ${attemptLabel}: download failed`, response);
		revokeObjectUrl(objectUrl);
		logDownload.warn(`Attempt ${attemptLabel}: download blocked (no tab fallback)`);
		toastPresenter.showBlockedNoTabFallback();
	} catch (error) {
		logDownload.error(`Attempt ${attemptLabel}: fetch error`, error);
		logDownload.warn(`Attempt ${attemptLabel}: download blocked (no tab fallback)`);
		toastPresenter.showBlockedNoTabFallback();
	}
};
