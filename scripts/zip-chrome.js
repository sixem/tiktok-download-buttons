// Creates a Chrome-ready zip from dist output.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBuildStamp, ensureDirectoryExists } from './utils/build.js';
import { createZip } from './utils/zip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const OUTPUT_DIR = path.join(PACKAGES_DIR, 'chrome');

const OUTPUT = path.join(OUTPUT_DIR, `chrome-${createBuildStamp()}.zip`);

const ensureOutputDir = async () => {
	await fs.mkdir(OUTPUT_DIR, { recursive: true });
};

const writeZip = async () => {
	await createZip({ sourceDir: DIST_DIR, outputZip: OUTPUT });
};

const run = async () => {
	await ensureDirectoryExists(DIST_DIR, 'dist folder not found. Run `pnpm build` first.');
	await ensureOutputDir();

	await writeZip();
	console.log(`Chrome zip written to ${path.relative(ROOT, OUTPUT)}`);
};

run().catch((error) => {
	console.error('[zip-chrome] Failed:', error);
	process.exit(1);
});
