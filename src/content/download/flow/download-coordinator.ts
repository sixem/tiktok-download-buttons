// Download coordinator (content script).
//
// This module is intentionally small:
// - dispatcher for browser runtime branches
// - shared setup/teardown (toast ID, listener wiring, button state)
// - immediate blob: URL short-circuit

import { TTDB, UTIL } from '@/content/core/state';
import {
	clearButtonLoading,
	getRuntimeInfo,
	getStoredSetting,
	hashString
} from '@/content/utils';
import { type DownloadMethodTag } from '@/content/download/flow/download-method';
import { executeChromiumBlobDownload } from '@/content/download/execute/execute-chromium-blob';
import { executeChromiumDownload } from '@/content/download/execute/execute-chromium';
import { executeFirefoxDownload } from '@/content/download/execute/execute-firefox';
import {
	executeInPageFetchBlobFallback,
	formatChainedMethodTag
} from '@/content/download/execute/in-page-fetch-fallback';
import {
	ensureDownloadStatusListener,
	prunePendingDownloadSessions
} from '@/content/download/state/session-store';
import { createDownloadToastPresenter } from '@/content/download/ui/toast-presenter';

export type DownloadContext = {
	videoKey?: string;
	source?: string;
	videoId?: string;
	user?: string | null;
};

type CoordinatorArgs = {
	url: string;
	filename: string;
	buttonElement?: HTMLElement | null;
	attemptId?: string | number | null;
	context?: DownloadContext | null;
	methodTag: DownloadMethodTag | null;
};

const createToastId = ({
	videoKey,
	attemptId
}: {
	videoKey: string;
	attemptId: string | number | null;
}) => {
	const keyHash = hashString(videoKey) || Date.now();
	return `download-${keyHash}${attemptId ? `-${attemptId}` : ''}`;
};

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

const resolveRuntime = async () => {
	const runtimeInfo = await getRuntimeInfo();

	return {
		firefox: runtimeInfo.isFirefox,
		chromium: runtimeInfo.isChromium
	};
};

const resolveSubFolder = async () => {
	const value = await getStoredSetting('download-subfolder-path');
	if (!(typeof value === 'string' || value instanceof String)) {
		return '';
	}
	return String(value);
};

const ensureCoordinatorDownloadStatusListener = () => {
	ensureDownloadStatusListener({
		onRetryRequested: ({ session }) => {
			const retryPresenter = createDownloadToastPresenter({
				toastId: String(session.toastId),
				filename: String(session.filename),
				methodTag: session.sourceTag || null
			});

			const chainedTag = formatChainedMethodTag(session.sourceTag || null, 'BLOB');
			void executeInPageFetchBlobFallback({
				url: String(session.originalUrl || ''),
				filename: String(session.filename || 'video.mp4'),
				toastPresenter: retryPresenter,
				toastTag: chainedTag,
				sourceTag: session.sourceTag || null,
				probeMode: 'video-content-type',
				logDownload: TTDB.LOG?.ns?.('download')
			}).then((started) => {
				if (!started) {
					retryPresenter.showInPageFetchResult({
						started: false,
						tag: chainedTag
					});
				}
			});
		},
		onTerminalStatus: ({ itemId, state, error, session }) => {
			const presenter = createDownloadToastPresenter({
				toastId: String(session.toastId),
				filename: String(session.filename),
				methodTag: session.sourceTag || null
			});

			presenter.showTerminalStatus({
				isComplete: state === 'complete',
				error,
				tag: session.sourceTag || null
			});

			TTDB.LOG?.ns?.('download')?.info?.('Download status', {
				itemId,
				state,
				error: error || null
			});
		}
	});
};

export const downloadWithMethodTag = async ({
	url,
	filename,
	buttonElement = null,
	attemptId = null,
	context = null,
	methodTag
}: CoordinatorArgs) => {
	const logDownload = TTDB.LOG.ns('download');
	const attemptLabel = attemptId ? `#${attemptId}` : 'unknown';
	const videoKey = context && context.videoKey ? String(context.videoKey) : '';
	const toastId = createToastId({
		videoKey,
		attemptId
	});
	const runtime = await resolveRuntime();
	const isBlobUrl = typeof url === 'string' && url.startsWith('blob:');

	let normalizedFilename = UTIL.sanitizeFilename(filename);
	if (normalizedFilename.length > 250) {
		normalizedFilename = UTIL.truncateString(normalizedFilename, 250);
	}

	const toastPresenter = createDownloadToastPresenter({
		toastId,
		filename: normalizedFilename,
		methodTag
	});

	ensureCoordinatorDownloadStatusListener();
	prunePendingDownloadSessions('download:start');

	logDownload.info(`Attempt ${attemptLabel}: download begin`, {
		url,
		filename: normalizedFilename,
		isBlobUrl,
		context,
		methodTag: methodTag || null
	});

	toastPresenter.showDownloading();

	try {
		const subFolder = await resolveSubFolder();

		if (isBlobUrl && runtime.chromium && subFolder) {
			await executeChromiumBlobDownload({
				url,
				originalUrl: url,
				filename: normalizedFilename,
				subFolder,
				toastId,
				methodTag,
				attemptLabel,
				toastPresenter,
				logDownload
			});
			return;
		}

		if (isBlobUrl) {
			const started = attemptBlobAnchorDownload(url, normalizedFilename || 'video.mp4');
			logDownload.info(`Attempt ${attemptLabel}: blob anchor ${started ? 'triggered' : 'failed'}`);
			toastPresenter.showInPageFetchResult({
				started,
				tag: methodTag || 'BLOB'
			});
			return;
		}

		if (runtime.chromium) {
			await executeChromiumDownload({
				url,
				filename: normalizedFilename,
				subFolder,
				toastId,
				methodTag,
				attemptLabel,
				toastPresenter,
				logDownload
			});
			return;
		}

		await executeFirefoxDownload({
			url,
			filename: normalizedFilename,
			subFolder,
			toastId,
			methodTag,
			attemptLabel,
			toastPresenter,
			logDownload
		});
	} finally {
		clearButtonLoading(buttonElement);
	}
};
