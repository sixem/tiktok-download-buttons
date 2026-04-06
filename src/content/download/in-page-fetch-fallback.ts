// Shared in-page fetch->blob fallback.
//
// This keeps retry behavior in one place so Firefox retry paths and future
// fallback call-sites do not drift in probe logic or toast semantics.

import { TTDB, UTIL } from '../state';
import { IN_PAGE_FETCH } from './constants';
import type { DownloadToastPresenter } from './toast-presenter';

export type InPageFetchProbeMode = 'strict' | 'video-content-type';

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

const validateProbeResponse = (response: Response, probeMode: InPageFetchProbeMode) => {
	if (probeMode === 'strict') {
		return {
			isValid: !!UTIL.validateVideoRequest(response) && !!response?.body,
			contentType: response?.headers?.get?.('Content-Type') || ''
		};
	}

	const contentType = response?.headers?.get?.('Content-Type') || '';
	const looksLikeVideo = contentType.includes('video/') || contentType.includes('application/octet-stream');
	return {
		isValid: !!response?.ok && !!response?.body && looksLikeVideo,
		contentType
	};
};

export const formatChainedMethodTag = (fromTag: string | null | undefined, toTag: string) => {
	if (!toTag) return fromTag || null;
	if (!fromTag) return toTag;
	if (fromTag === toTag) return toTag;
	return `${fromTag}->${toTag}`;
};

export const executeInPageFetchBlobFallback = async ({
	url,
	filename,
	toastPresenter,
	toastTag,
	sourceTag = null,
	probeMode = 'video-content-type',
	logDownload,
	showFailureToast = true
}: {
	url: string;
	filename: string;
	toastPresenter: DownloadToastPresenter;
	toastTag?: string | null;
	sourceTag?: string | null;
	probeMode?: InPageFetchProbeMode;
	logDownload: any;
	showFailureToast?: boolean;
}) => {
	const resolvedToastTag = typeof toastTag === 'string' ? toastTag : sourceTag;

	if (!url || typeof url !== 'string' || !/^https?:/i.test(url)) {
		toastPresenter.showInPageFetchResult({
			started: false,
			tag: resolvedToastTag,
			showFailureToast
		});
		return false;
	}

	try {
		toastPresenter.showRetryingInPageFetch();

		const response = await fetch(url, TTDB.headers);
		const probe = validateProbeResponse(response, probeMode);
		if (!probe.isValid) {
			logDownload?.warn?.('in-page fetch fallback probe failed', {
				status: response?.status,
				contentType: probe.contentType || null,
				probeMode,
				sourceTag: sourceTag || null
			});
			toastPresenter.showInPageFetchResult({
				started: false,
				tag: resolvedToastTag,
				showFailureToast
			});
			return false;
		}

		const blob = await response.blob();
		const blobUrl = URL.createObjectURL(blob);
		const started = attemptBlobAnchorDownload(blobUrl, filename);

		setTimeout(() => {
			try {
				URL.revokeObjectURL(blobUrl);
			} catch (_) {
				// Best-effort cleanup.
			}
		}, IN_PAGE_FETCH.blobRevokeDelayMs);

		toastPresenter.showInPageFetchResult({
			started,
			tag: resolvedToastTag,
			showFailureToast
		});

		logDownload?.info?.('in-page fetch fallback result', {
			started,
			probeMode,
			sourceTag: sourceTag || null
		});
		return started;
	} catch (error) {
		logDownload?.warn?.('in-page fetch fallback error', {
			error,
			probeMode,
			sourceTag: sourceTag || null
		});
		toastPresenter.showInPageFetchResult({
			started: false,
			tag: resolvedToastTag,
			showFailureToast
		});
		return false;
	}
};
