// DOM helper for starting downloads from page-owned blob URLs.
//
// The browser download APIs cannot always consume page-origin blob URLs directly,
// so callers can trigger the same user-visible anchor download from one place.
export const attemptBlobAnchorDownload = (blobUrl: string, filename: string) => {
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
