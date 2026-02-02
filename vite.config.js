import { defineConfig } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, 'dist');
const STATIC_FILES = [
	'manifest.json',
	'popup.html'
];

const copyFile = async (src, dest) => {
	await fs.mkdir(path.dirname(dest), { recursive: true });
	await fs.copyFile(src, dest);
};

const copyExtensionAssets = () => ({
	name: 'copy-extension-assets',
	apply: 'build',
	async closeBundle() {
		await Promise.all(
			STATIC_FILES.map((file) => copyFile(
				path.join(SRC_DIR, file),
				path.join(OUT_DIR, file)
			))
		);
	}
});

export default defineConfig({
	publicDir: 'public',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: path.join(SRC_DIR, 'main.ts'),
				service: path.join(SRC_DIR, 'service.ts'),
				popup: path.join(SRC_DIR, 'popup.ts')
			},
			output: {
				entryFileNames: '[name].js',
				chunkFileNames: '[name].js',
				assetFileNames: '[name][extname]'
			}
		}
	},
	plugins: [copyExtensionAssets()]
});
