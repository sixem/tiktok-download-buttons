// Download attempt resolution pipeline.
//
// This module is intentionally side-effect free at the call-site level:
// - callers pass resolved inputs (button attrs, DOM URL candidates, runtime flags)
// - this module returns a deterministic decision object used by UI/event wiring
//
// Keeping this logic centralized makes strategy selection easier to test.

import { getWebApiData } from '@/content/api/web-detail';
import { getItemDetailApiData } from '@/content/api/item-detail';
import { isBlobUrl, isHttpUrl } from '@/content/utils';
import { getFileNameTemplate } from './filename';

export type DownloadAttemptSource =
	| 'web-api'
	| 'item-detail-api'
	| 'dom'
	| 'preview-cache'
	| 'dom-blob'
	| null;

export type DownloadAttemptAttrs = {
	filename: string | null;
	apiId: string | null;
	url: string | null;
	pageUrl: string | null;
};

export type DownloadAttemptEnv = {
	chromium: boolean;
};

export type DownloadAttemptCandidates = {
	domVideoUrl: string | null;
	previewCachedUrl: string | null;
	previewWaitedUrl: string | null;
	previewWaitAttempted: boolean;
};

type ApiResolution = {
	videoUrl: string | null;
	source: DownloadAttemptSource;
	apiData: any;
};

export type ResolveDownloadAttemptResult = {
	videoUrl: string | null;
	source: DownloadAttemptSource;
	filename: string | null;
	apiData: any;
	needsPreviewWait: boolean;
	blockedReason: 'firefox-blob' | null;
};

const getWebVideoUrl = (webData: any) => {
	const video = webData && webData.video ? webData.video : null;
	if (!video) return null;

	const candidates = [
		video.playAddr,
		video.downloadAddr,
		video.playAddrH264,
		video.playAddrBytevc1
	];

	for (const candidate of candidates) {
		if (!candidate) continue;
		if (typeof candidate === 'string') return candidate;
		if (Array.isArray(candidate) && candidate.length) return candidate[0];
		if (candidate.urlList && candidate.urlList.length) return candidate.urlList[0];
		if (candidate.url_list && candidate.url_list.length) return candidate.url_list[0];
	}

	return null;
};

// Resolve URL and metadata from API sources when needed.
//
// Behavior intentionally mirrors previous logic:
// - item-detail API is only attempted when web API throws.
const resolveApiSource = async ({
	videoData,
	apiId,
	pageUrl
}: {
	videoData: any;
	apiId: string | null;
	pageUrl: string | null;
}): Promise<ApiResolution> => {
	try {
		const webData = await getWebApiData({
			...videoData,
			...{
				videoApiId: apiId,
				pageUrl
			}
		});
		const webVideoUrl = getWebVideoUrl(webData);
		if (webVideoUrl) {
			return {
				videoUrl: webVideoUrl,
				source: 'web-api',
				apiData: webData
			};
		}
	} catch (_) {
		try {
			const itemDetailData = await getItemDetailApiData(apiId);
			const itemDetailUrl = getWebVideoUrl(itemDetailData);
			if (itemDetailUrl) {
				return {
					videoUrl: itemDetailUrl,
					source: 'item-detail-api',
					apiData: itemDetailData
				};
			}
		} catch (_) {
			// Fall through to unresolved result.
		}
	}

	return {
		videoUrl: null,
		source: null,
		apiData: null
	};
};

const resolveFilename = ({
	defaultFilename,
	nameTemplate,
	videoData,
	apiData
}: {
	defaultFilename: string | null;
	nameTemplate: string | false;
	videoData: any;
	apiData: any;
}) => {
	if (!nameTemplate) {
		return defaultFilename;
	}

	return getFileNameTemplate(videoData, apiData || {}, nameTemplate) || defaultFilename;
};

export const resolveDownloadAttempt = async ({
	videoData,
	attrs,
	env,
	nameTemplate,
	candidates
}: {
	videoData: any;
	attrs: DownloadAttemptAttrs;
	env: DownloadAttemptEnv;
	nameTemplate: string | false;
	candidates: DownloadAttemptCandidates;
}): Promise<ResolveDownloadAttemptResult> => {
	const apiResolution = await resolveApiSource({
		videoData,
		apiId: attrs.apiId,
		pageUrl: attrs.pageUrl
	});

	const domUrl = candidates.domVideoUrl || null;
	const domIsBlob = isBlobUrl(domUrl);
	const domIsHttp = isHttpUrl(domUrl);

	let videoUrl: string | null = null;
	let source: DownloadAttemptSource = null;
	let needsPreviewWait = false;
	let blockedReason: 'firefox-blob' | null = null;

	if (apiResolution.videoUrl) {
		videoUrl = apiResolution.videoUrl;
		source = apiResolution.source;
	} else if (domIsHttp) {
		videoUrl = domUrl;
		source = 'dom';
	}

	if (!videoUrl && candidates.previewCachedUrl) {
		videoUrl = candidates.previewCachedUrl;
		source = 'preview-cache';
	}

	// Preview wait is a caller-managed UX step. The pipeline only signals whether it should run.
	if (!videoUrl && attrs.apiId && !candidates.previewCachedUrl && !candidates.previewWaitAttempted) {
		needsPreviewWait = true;
	}

	if (!videoUrl && candidates.previewWaitedUrl) {
		videoUrl = candidates.previewWaitedUrl;
		source = 'preview-cache';
	}

	if (!videoUrl && !needsPreviewWait && domIsBlob) {
		if (env.chromium) {
			videoUrl = domUrl;
			source = 'dom-blob';
		} else {
			blockedReason = 'firefox-blob';
		}
	}

	const filename = resolveFilename({
		defaultFilename: attrs.filename,
		nameTemplate,
		videoData,
		apiData: apiResolution.apiData
	});

	return {
		videoUrl,
		source,
		filename: filename || attrs.filename,
		apiData: apiResolution.apiData,
		needsPreviewWait,
		blockedReason
	};
};
