import { promises as fs } from 'node:fs';

const pad = (value) => String(value).padStart(2, '0');

export const createBuildStamp = (date = new Date()) => {
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

export const ensureDirectoryExists = async (dir, errorMessage) => {
	const stat = await fs.stat(dir).catch(() => null);
	if (!stat?.isDirectory()) {
		throw new Error(errorMessage);
	}
};

export const createBuildToken = ({
	length = 5,
	date = new Date()
} = {}) => {
	const normalizedLength = Math.max(4, Number(length) || 5);
	const timePart = date.getTime().toString(16);
	const randomMax = 16 ** 3;
	const randomPart = Math.floor(Math.random() * randomMax).toString(16).padStart(3, '0');
	const token = `${timePart}${randomPart}`;
	return token.length >= normalizedLength
		? token.slice(-normalizedLength)
		: token.padStart(normalizedLength, '0');
};

export const withBuildVersionName = (manifest, buildToken) => {
	if (!manifest || typeof manifest !== 'object' || !buildToken) {
		return manifest;
	}

	const baseVersionName = typeof manifest.version_name === 'string' && manifest.version_name.trim()
		? manifest.version_name.trim()
		: String(manifest.version || '').trim();

	if (!baseVersionName) {
		return manifest;
	}

	return {
		...manifest,
		version_name: `${baseVersionName} (${buildToken})`
	};
};
