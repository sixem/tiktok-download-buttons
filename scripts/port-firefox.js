// Builds a Firefox-compatible package by staging the Vite build and applying the Firefox manifest.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBuildStamp, ensureDirectoryExists } from './utils/build.js';
import { createZip } from './utils/zip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const FF_MANIFEST = path.join(ROOT, 'scripts', 'firefox', 'manifest.json');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const OUTPUT_DIR = path.join(PACKAGES_DIR, 'firefox');
const STAGING_ROOT = path.join(PACKAGES_DIR, '.tmp');

const stamp = createBuildStamp();
const OUTPUT_ZIP = path.join(OUTPUT_DIR, `firefox-${stamp}.zip`);
const STAGING_DIR = path.join(STAGING_ROOT, `firefox-${stamp}`);

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

// We intentionally keep the `chrome.*` namespace intact for Firefox.
// Firefox supports it for compatibility and it keeps callback-based code working.

// Creates a Firefox-ready archive that keeps entry paths valid for AMO validation.
const writeZip = async () => {
	await createZip({ sourceDir: STAGING_DIR, outputZip: OUTPUT_ZIP });
};

const run = async () => {
	await ensureDirectoryExists(DIST_DIR, 'dist folder not found. Run `pnpm build` first.');
	await ensureDirs();

	const distFiles = await listFiles(DIST_DIR);
	for (const filePath of distFiles) {
		const relPath = path.relative(DIST_DIR, filePath);
		const target = path.join(STAGING_DIR, relPath);
		await copyFile(filePath, target);
	}

	await copyFile(FF_MANIFEST, path.join(STAGING_DIR, 'manifest.json'));

	await writeZip();

	await fs.rm(STAGING_DIR, { recursive: true, force: true });
	console.log(`Firefox zip written to ${path.relative(ROOT, OUTPUT_ZIP)}`);
};

run().catch((error) => {
	console.error('[port-firefox] Failed:', error);
	process.exit(1);
});
