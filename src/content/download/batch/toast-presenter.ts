// Toast rendering for image batch progress/final states.

import { SPLASH } from '@/content/core/state';
import { IMAGE_BATCH } from '@/content/download/constants';
import type { BatchSession } from '@/content/download/batch/types';
import { getDoneCount } from '@/content/download/batch/session-store';

export const renderProgressToast = (batch: BatchSession) => {
	if (!SPLASH || typeof SPLASH.message !== 'function') return;

	const done = getDoneCount(batch);
	const remaining = Math.max(batch.total - done, 0);
	SPLASH.message({
		title: 'Downloading images',
		detail: `${done}/${batch.total} completed`,
		meta: `Failed: ${batch.failed} | Remaining: ${remaining}`
	}, {
		id: batch.toastId,
		state: 0,
		sticky: true,
		spinner: true,
		hideMeta: false,
		tag: null
	});
};

export const renderFinalToast = (batch: BatchSession) => {
	if (!SPLASH || typeof SPLASH.message !== 'function') return;

	if (batch.failed === 0) {
		SPLASH.message({
			title: 'Images downloaded',
			detail: `${batch.completed}/${batch.total} completed`
		}, {
			id: batch.toastId,
			state: 1,
			sticky: false,
			spinner: false,
			duration: 5000,
			hideMeta: true,
			tag: IMAGE_BATCH.toastTag
		});
		return;
	}

	if (batch.completed > 0) {
		SPLASH.message({
			title: 'Image batch finished',
			detail: `${batch.completed}/${batch.total} completed`,
			meta: `${batch.failed} failed`
		}, {
			id: batch.toastId,
			state: 2,
			sticky: false,
			spinner: false,
			duration: 6000,
			hideMeta: false,
			tag: IMAGE_BATCH.toastTag
		});
		return;
	}

	SPLASH.message({
		title: 'Image download failed',
		detail: 'No selected images could be downloaded.'
	}, {
		id: batch.toastId,
		state: 3,
		sticky: false,
		spinner: false,
		duration: 6500,
		hideMeta: true,
		tag: IMAGE_BATCH.toastTag
	});
};

export const showNoImagesSelectedToast = () => {
	SPLASH?.message?.({
		title: 'No images selected',
		detail: 'Choose at least one image to download.'
	}, {
		state: 2,
		duration: 3600,
		hideMeta: true,
		tag: IMAGE_BATCH.toastTag
	});
};
