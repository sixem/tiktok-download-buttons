// Zip helper for build scripts.
// Uses platform-appropriate tools and keeps Windows entries normalized for Firefox validation.
import { spawn } from 'node:child_process';
import path from 'node:path';

const runCommand = (cmd, args, options = {}) => new Promise((resolve, reject) => {
	const proc = spawn(cmd, args, { stdio: 'inherit', ...options });
	proc.on('error', reject);
	proc.on('close', (code) => {
		if (code === 0) {
			resolve();
		} else {
			reject(new Error(`${cmd} exited with code ${code}`));
		}
	});
});

const runZipCli = (sourceDir, outputZip) => runCommand(
	'zip',
	['-r', outputZip, '.'],
	{ cwd: sourceDir }
);

const run7z = (sourceDir, outputZip) => runCommand(
	'7z',
	['a', '-tzip', outputZip, '.'],
	{ cwd: sourceDir }
);

const toPowerShellString = (value) => `'${value.replaceAll("'", "''")}'`;

const buildPowerShellZipCommand = (sourceDir, outputZip) => {
	const source = toPowerShellString(path.resolve(sourceDir));
	const output = toPowerShellString(path.resolve(outputZip));

	// Ensure we produce forward-slash entry names for Firefox add-on validation.
	return [
		'$ErrorActionPreference = "Stop"',
		`$source = ${source}`,
		`$output = ${output}`,
		'if (Test-Path $output) { Remove-Item $output }',
		'Add-Type -AssemblyName System.IO.Compression.FileSystem',
		'$zip = [System.IO.Compression.ZipFile]::Open($output, "Create")',
		'Get-ChildItem -Path $source -Recurse -File | ForEach-Object {',
		'  $relative = $_.FullName.Substring($source.Length).TrimStart(\'\\\', \'/\')',
		'  $entryName = $relative -replace \'\\\\\', \'/\'',
		'  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(' +
			'$zip, $_.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal' +
			') | Out-Null',
		'}',
		'$zip.Dispose()'
	].join('; ');
};

const runPowerShellZip = (sourceDir, outputZip) => runCommand(
	'powershell',
	['-NoProfile', '-Command', buildPowerShellZipCommand(sourceDir, outputZip)]
);

const runPwshZip = (sourceDir, outputZip) => runCommand(
	'pwsh',
	['-NoProfile', '-Command', buildPowerShellZipCommand(sourceDir, outputZip)]
);

const tryCommand = async (runner) => {
	try {
		await runner();
		return true;
	} catch (error) {
		if (error && error.code === 'ENOENT') {
			return false;
		}
		throw error;
	}
};

export const createZip = async ({ sourceDir, outputZip }) => {
	if (process.platform === 'win32') {
		const usedPowerShell = await tryCommand(() => runPowerShellZip(sourceDir, outputZip));
		if (usedPowerShell) {
			return 'powershell';
		}

		const usedPwsh = await tryCommand(() => runPwshZip(sourceDir, outputZip));
		if (usedPwsh) {
			return 'pwsh';
		}

		throw new Error('PowerShell is required to build a Firefox-safe zip on Windows.');
	}

	if (await tryCommand(() => runZipCli(sourceDir, outputZip))) {
		return 'zip';
	}

	if (await tryCommand(() => run7z(sourceDir, outputZip))) {
		return '7z';
	}

	if (await tryCommand(() => runPwshZip(sourceDir, outputZip))) {
		return 'pwsh';
	}

	throw new Error('No zip tool found. Install zip, 7z, or PowerShell.');
};
