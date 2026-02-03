import { spawn } from 'node:child_process';

const run = (cmd, args) => new Promise((resolve, reject) => {
	const proc = spawn(cmd, args, { stdio: 'inherit', shell: true });
	proc.on('error', reject);
	proc.on('close', (code) => {
		if (code === 0) {
			resolve();
		} else {
			reject(new Error(`${cmd} exited with code ${code}`));
		}
	});
});

const main = async () => {
	await run('pnpm', ['build']);
	await run('node', ['scripts/port-firefox.js']);
	await run('node', ['scripts/zip-chrome.js']);
};

main().catch((error) => {
	console.error('[package] Failed:', error);
	process.exit(1);
});
