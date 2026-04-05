import { promises as fs } from 'node:fs';

const pad = (value) => String(value).padStart(2, '0');

export const createBuildStamp = (date = new Date()) => {
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

export const ensureDirectoryExists = async (dir, errorMessage) => {
	const stat = await fs.stat(dir).catch(() => null);
	if (!stat || !stat.isDirectory()) {
		throw new Error(errorMessage);
	}
};
