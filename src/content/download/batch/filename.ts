// Filename helpers for slideshow/image batch downloads.
//
// The goal is to keep source names recognizable while still producing Windows-safe
// filenames that work through the browser downloads API.

import { IMAGE_BATCH } from '@/content/download/constants';

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;

const replaceControlCharacters = (value: string) => {
	let sanitized = '';

	for (const char of value) {
		const code = char.charCodeAt(0);
		sanitized += code <= 0x1f ? ' ' : char;
	}

	return sanitized;
};

const sanitizeFilenamePart = (value: string, fallback = IMAGE_BATCH.defaultBasename) => {
	const safe = replaceControlCharacters(String(value || ''))
		.replace(INVALID_FILENAME_CHARS, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^\.+/, '');

	return (safe || fallback).slice(0, IMAGE_BATCH.maxBasenameLength).trim();
};

const sanitizeExtension = (value: string) => {
	const cleaned = String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');

	if (!cleaned) return null;
	return cleaned === 'jpeg' ? 'jpg' : cleaned;
};

const getImageExtension = (url: string) => {
	try {
		const parsed = new URL(url);
		const path = parsed.pathname || '';
		const match = /\.([a-z0-9]{1,8})$/i.exec(path);
		if (!match) return IMAGE_BATCH.defaultExtension;
		return sanitizeExtension(match[1]) || IMAGE_BATCH.defaultExtension;
	} catch (_) {
		return IMAGE_BATCH.defaultExtension;
	}
};

const getFilenamePartsFromUrl = (url: string) => {
	try {
		const parsed = new URL(url);
		const rawPath = parsed.pathname || '';
		const pathParts = rawPath.split('/').filter(Boolean);
		const lastSegment = pathParts[pathParts.length - 1] || '';
		const decodedLastSegment = decodeURIComponent(lastSegment).trim();
		if (!decodedLastSegment) {
			return null;
		}

		const dotIndex = decodedLastSegment.lastIndexOf('.');
		if (dotIndex <= 0 || dotIndex >= decodedLastSegment.length - 1) {
			return {
				baseName: sanitizeFilenamePart(decodedLastSegment),
				extension: getImageExtension(url)
			};
		}

		const rawBaseName = decodedLastSegment.slice(0, dotIndex);
		const rawExtension = decodedLastSegment.slice(dotIndex + 1);
		return {
			baseName: sanitizeFilenamePart(rawBaseName),
			extension: sanitizeExtension(rawExtension) || getImageExtension(url)
		};
	} catch (_) {
		return null;
	}
};

// Keep source names recognizable:
// - decode URL pathname segments
// - preserve extension when possible
// - append order suffix only for multi-item downloads
const buildFilename = (index: number, total: number, url: string) => {
	const parsedFilename = getFilenamePartsFromUrl(url);
	const baseName = parsedFilename?.baseName || IMAGE_BATCH.defaultBasename;
	const extension = parsedFilename?.extension || getImageExtension(url);
	if (total <= 1) {
		return `${baseName}.${extension}`;
	}

	const padLength = Math.max(2, String(total).length);
	const sequence = String(index + 1).padStart(padLength, '0');
	return `${baseName}-${sequence}.${extension}`;
};

// Grouped export keeps tests and re-exports concise.
export const imageBatchFilenameHelpers = {
	replaceControlCharacters,
	sanitizeFilenamePart,
	getImageExtension,
	getFilenamePartsFromUrl,
	buildFilename
};
