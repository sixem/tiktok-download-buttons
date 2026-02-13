// Backwards-compatible re-export.
// New call-sites should import from `asset-picker-modal.ts`.
export {
	type PickerAsset,
	type OpenAssetPickerOptions,
	openAssetPickerModal,
	setupAssetPickerModal,
	openSlideshowModal,
	setupSlideshowModal
} from './asset-picker-modal';

