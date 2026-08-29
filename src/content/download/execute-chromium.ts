// Chromium download executor.
//
// Chromium probes the URL in-page, then hands an object URL to the service worker
// so the browser can complete the download without a second network request.

import { TTDB, UTIL } from '../state';
import { sendRuntimeMessage } from '../utils/extension';
import type { DownloadMethodTag } from './download-method';
import { registerPendingDownloadSession } from './session-store';
import type { DownloadToastPresenter } from './toast-presenter';

const CHROMIUM_SAFETY_REVOKE_MS = 2 * 60 * 60 * 1000; // 2 hours

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
	// Helper para fallback in-page quando probe falha ou chrome.downloads falha com NETWORK_FAILED
	const tryInPageFallback = async (reason: string) => {
		try {
			const { executeInPageFetchBlobFallback, formatChainedMethodTag } = await import('./in-page-fetch-fallback');
			const chainedTag = formatChainedMethodTag(methodTag, 'BLOB');
			logDownload.warn(`Attempt ${attemptLabel}: probe falhou (${reason}), tentando fallback in-page BLOB`, { url });
			const ok = await executeInPageFetchBlobFallback({
				url,
				filename,
				toastPresenter,
				toastTag: chainedTag,
				sourceTag: methodTag,
				probeMode: 'video-content-type',
				logDownload,
				showFailureToast: true
			});
			return ok;
		} catch (e) {
			logDownload.warn(`Attempt ${attemptLabel}: fallback error`, e);
			return false;
		}
	};

	let probeResponse: Response | null = null;
	try {
		// Tenta fetch com headers padrão, se falhar tenta sem credentials (CORS)
		try {
			probeResponse = await fetch(url, TTDB.headers);
		} catch (e) {
			logDownload.warn(`Attempt ${attemptLabel}: fetch com credentials falhou, retry sem credentials`, e);
			probeResponse = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache', redirect: 'follow' } as any);
		}

		// Validação leniente: se Content-Length ausente mas é video, permite
		const isValid = probeResponse && (UTIL.validateVideoRequest(probeResponse) || UTIL.validateVideoRequestLenient?.(probeResponse)) && !!probeResponse.body;
		if (!isValid || !probeResponse) {
			const ct = probeResponse?.headers.get('Content-Type') || '';
			const status = probeResponse?.status ?? 'no-response';
			// Se probe falhou mas status é 200 e body existe, tenta blob direto (alguns CDNs não enviam content-type correto no HEAD)
			if (probeResponse && probeResponse.ok && probeResponse.body) {
				logDownload.warn(`Attempt ${attemptLabel}: probe strict falhou mas response ok, tentando blob direto`, { ct, status });
			} else {
				logDownload.warn(
					`Attempt ${attemptLabel}: probe failed (${ct} - ${status})`,
					probeResponse
				);
				await tryInPageFallback(`probe ${status} ${ct}`);
				return;
			}
		}

		// Se probeResponse é html (challenge) detecta e fallback
		const ctProbe = probeResponse.headers.get('Content-Type') || '';
		if (ctProbe.includes('text/html')) {
			logDownload.warn(`Attempt ${attemptLabel}: probe retornou HTML (challenge?)`, { ct: ctProbe });
			await tryInPageFallback('HTML challenge');
			return;
		}

		logDownload.info(`Attempt ${attemptLabel}: probe valid`, probeResponse);

		// Se probeResponse não é reutilizável (já consumida?), refetch como blob se necessário
		let responseBlob: Blob;
		try {
			responseBlob = await probeResponse.blob();
		} catch (e) {
			logDownload.warn(`Attempt ${attemptLabel}: blob() falhou, refetch`, e);
			const r2 = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache', redirect: 'follow' } as any);
			if (!r2.ok || !r2.body) {
				await tryInPageFallback('blob retry failed');
				return;
			}
			responseBlob = await r2.blob();
		}

		// Garante filename tem .mp4
		if (!filename.toLowerCase().endsWith('.mp4')) {
			filename = filename.replace(/\.[^/.]+$/, '') + '.mp4';
		}

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
			// tenta fallback in-page antes de mostrar bloqueado
			const fell = await tryInPageFallback('download request failed');
			if (!fell) toastPresenter.showBlockedNoTabFallback();
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
		// Se chrome.downloads falhou (ex: NETWORK_FAILED, SERVER_FAILED), tenta fallback
		const fell = await tryInPageFallback(`downloads API failed: ${response?.error || 'unknown'}`);
		if (!fell) toastPresenter.showBlockedNoTabFallback();
	} catch (error) {
		logDownload.error(`Attempt ${attemptLabel}: fetch error`, error);
		// fallback direto para BLOB via fetch in-page (bypassa downloads API)
		try {
			const { executeInPageFetchBlobFallback, formatChainedMethodTag } = await import('./in-page-fetch-fallback');
			const chainedTag = formatChainedMethodTag(methodTag, 'BLOB');
			await executeInPageFetchBlobFallback({
				url, filename, toastPresenter, toastTag: chainedTag, sourceTag: methodTag,
				probeMode: 'video-content-type', logDownload, showFailureToast: true
			});
			return;
		} catch (e) {}
		toastPresenter.showBlockedNoTabFallback();
	}
};
