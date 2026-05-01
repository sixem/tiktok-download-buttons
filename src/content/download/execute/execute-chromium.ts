// Chromium download executor.
//
// Chromium probes the URL in-page, then hands an object URL to the service worker
// so the browser can complete the download without a second network request.

import { TTDB, UTIL } from '@/content/core/state';
import { sendRuntimeMessage } from '@/content/utils';
import { registerPendingDownloadSession } from '@/content/download/state/session-store';
import type { DownloadToastPresenter } from '@/content/download/ui/toast-presenter';
import type { DownloadTag } from '@/types';

const CHROMIUM_SAFETY_REVOKE_MS = 2 * 60 * 60 * 1000;

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
	sourceTag,
	attemptLabel,
	toastPresenter,
	logDownload
}: {
	url: string;
	filename: string;
	subFolder: string;
	toastId: string;
	sourceTag: DownloadTag;
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

		if (response?.success && typeof response.itemId === 'number') {
			// Chromium only needs terminal state. The service worker installs a minimal
			// active-session `downloads.onChanged` listener and sends one final status.
			registerPendingDownloadSession({
				itemId: response.itemId,
				session: {
					objectUrl,
					startedAtMs: Date.now(),
					toastId,
					filename,
					sourceTag,
					originalUrl: url,
					hasRetried: false
				},
				safetyTimeoutMs: CHROMIUM_SAFETY_REVOKE_MS
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
