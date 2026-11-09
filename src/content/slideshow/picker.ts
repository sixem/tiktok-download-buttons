// Shared slideshow picker launcher.
//
// Feed and browser photo-mode cards use the same picker UX and image batch download flow.
// This keeps call-sites small and prevents drift between modes.

import { downloadImageBatch } from '@/content/download/batch/image-batch-coordinator';
import { openAssetPickerModal } from '@/content/ui/asset-picker-modal';

type OpenSlideshowPickerArgs = {
	imageUrls: string[];
	assetIdPrefix: string;
	title?: string;
	subtitle?: string;
	hint?: string;
	primaryLabel?: string;
};

const DEFAULT_TITLE = 'Select images';
const DEFAULT_SUBTITLE = 'Choose which images to keep selected for download.';
const DEFAULT_HINT = 'Select one or more images, then click Download selected.';
const DEFAULT_PRIMARY_LABEL = 'Download selected';
const DEFAULT_LABEL_PREFIX = 'Image';

const buildSlideshowAssets = (imageUrls: string[], assetIdPrefix: string) => {
	return imageUrls.map((url, index) => ({
		id: `${assetIdPrefix}-${index + 1}`,
		url,
		label: `${DEFAULT_LABEL_PREFIX} ${index + 1}`
	}));
};

export const openSlideshowPicker = ({
	imageUrls,
	assetIdPrefix,
	title = DEFAULT_TITLE,
	subtitle = DEFAULT_SUBTITLE,
	hint = DEFAULT_HINT,
	primaryLabel = DEFAULT_PRIMARY_LABEL
}: OpenSlideshowPickerArgs) => {
	if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
		return false;
	}

	openAssetPickerModal({
		assets: buildSlideshowAssets(imageUrls, assetIdPrefix),
		title,
		subtitle,
		hint,
		primaryLabel,
		onPrimary: (selectedAssets) => {
			downloadImageBatch({
				assets: selectedAssets
			});
		}
	});

	return true;
};
