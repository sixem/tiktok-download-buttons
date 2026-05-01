// Downloadable media asset contracts.

export type DownloadableImageAsset = {
	id?: string;
	url: string;
	label?: string;
};

export type DownloadImageBatchArgs = {
	assets: DownloadableImageAsset[];
	subFolder?: string | null;
};
