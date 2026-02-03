// Builds a Firefox-compatible package by staging the Vite build and swapping APIs.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createZip } from './utils/zip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const FF_MANIFEST = path.join(ROOT, 'scripts', 'firefox', 'manifest.json');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const OUTPUT_DIR = path.join(PACKAGES_DIR, 'firefox');
const STAGING_ROOT = path.join(PACKAGES_DIR, '.tmp');

const timestamp = new Date();
const pad = (value) => String(value).padStart(2, '0');
const stamp = `${timestamp.getFullYear()}${pad(timestamp.getMonth() + 1)}${pad(timestamp.getDate())}-${pad(timestamp.getHours())}${pad(timestamp.getMinutes())}${pad(timestamp.getSeconds())}`;
const OUTPUT_ZIP = path.join(OUTPUT_DIR, `firefox-${stamp}.zip`);
const STAGING_DIR = path.join(STAGING_ROOT, `firefox-${stamp}`);

// Firefox prefers the browser.* namespace, so swap the common extension APIs.
const REPLACEMENTS = [
	['chrome.runtime', 'browser.runtime'],
	['chrome.storage', 'browser.storage'],
	['chrome.downloads', 'browser.downloads'],
	['chrome.tabs', 'browser.tabs']
];

const ensureDist = async () => {
	const stat = await fs.stat(DIST_DIR).catch(() => null);
	if (!stat || !stat.isDirectory()) {
		throw new Error('dist folder not found. Run `pnpm build` first.');
	}
};

const ensureDirs = async () => {
	await fs.mkdir(OUTPUT_DIR, { recursive: true });
	await fs.mkdir(STAGING_DIR, { recursive: true });
};

const copyFile = async (from, to) => {
	await fs.mkdir(path.dirname(to), { recursive: true });
	await fs.copyFile(from, to);
};

const listFiles = async (dir) => {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...await listFiles(fullPath));
		} else {
			files.push(fullPath);
		}
	}

	return files;
};

const replaceInFile = async (filePath) => {
	const content = await fs.readFile(filePath, 'utf8');
	let updated = content;
	for (const [from, to] of REPLACEMENTS) {
		updated = updated.split(from).join(to);
	}
	if (updated !== content) {
		await fs.writeFile(filePath, updated, 'utf8');
	}
};

// Creates a Firefox-ready archive that keeps entry paths valid for AMO validation.
const writeZip = async () => {
	await createZip({ sourceDir: STAGING_DIR, outputZip: OUTPUT_ZIP });
};

const run = async () => {
	await ensureDist();
	await ensureDirs();

	const distFiles = await listFiles(DIST_DIR);
	for (const filePath of distFiles) {
		const relPath = path.relative(DIST_DIR, filePath);
		const target = path.join(STAGING_DIR, relPath);
		await copyFile(filePath, target);
	}

	await copyFile(FF_MANIFEST, path.join(STAGING_DIR, 'manifest.json'));

	const stagedFiles = await listFiles(STAGING_DIR);
	for (const filePath of stagedFiles) {
		if (filePath.endsWith('.js') || filePath.endsWith('.html')) {
			await replaceInFile(filePath);
		}
	}

	await writeZip();

	await fs.rm(STAGING_DIR, { recursive: true, force: true });
	console.log(`Firefox zip written to ${path.relative(ROOT, OUTPUT_ZIP)}`);
};

run().catch((error) => {
	console.error('[port-firefox] Failed:', error);
	process.exit(1);
});
