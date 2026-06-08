import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const version = process.env.VERSION;
if (!version) {
	console.error('Error: VERSION env variable is required');
	process.exit(1);
}

const rootDir = path.join(__dirname, '..');
const artifactsDir = path.join(rootDir, 'artifacts');
const distDir = path.join(rootDir, 'dist');

// Reset dist directory
if (fs.existsSync(distDir)) {
	fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Helper to find all files recursively matching a filter
function findFiles(dir, filter, files = []) {
	if (!fs.existsSync(dir)) return files;
	const list = fs.readdirSync(dir);
	for (const file of list) {
		const fullPath = path.join(dir, file);
		const stat = fs.statSync(fullPath);
		if (stat.isDirectory()) {
			findFiles(fullPath, filter, files);
		} else if (filter(file)) {
			files.push(fullPath);
		}
	}
	return files;
}

// Check if GPG key is loaded and export public key
let hasGpg = false;
try {
	execSync('gpg --list-keys "Tauri App Template"', { stdio: 'ignore' });
	hasGpg = true;
	console.log('Found GPG key "Tauri App Template". Exporting public key...');
	execSync(
		'gpg --armor --export "Tauri App Template" > dist/tauri-app-template.gpg',
		{ cwd: rootDir },
	);
	console.log('Public key exported to dist/tauri-app-template.gpg');
} catch {
	console.log(
		'Warning: GPG key "Tauri App Template" not found. Repositories will not be signed.',
	);
}

// 1. Process Debian repository
console.log('Generating Debian APT repository metadata...');
const debFiles = findFiles(artifactsDir, (f) => f.endsWith('.deb'));
const debDistDir = path.join(distDir, 'debian');
fs.mkdirSync(debDistDir, { recursive: true });

if (debFiles.length > 0) {
	// Copy debs to debDistDir temporarily so dpkg-scanpackages can run on them
	for (const file of debFiles) {
		fs.copyFileSync(file, path.join(debDistDir, path.basename(file)));
	}

	// Run dpkg-scanpackages
	try {
		console.log('Running dpkg-scanpackages...');
		const packagesContent = execSync('dpkg-scanpackages . /dev/null', {
			cwd: debDistDir,
			encoding: 'utf8',
		});

		// Replace Filename: ./filename.deb with absolute GitHub release URL
		const lines = packagesContent.split('\n');
		const modifiedLines = lines.map((line) => {
			if (line.startsWith('Filename: ./')) {
				const filename = line.replace('Filename: ./', '');
				return `Filename: https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v${version}/${filename}`;
			}
			return line;
		});

		const packagesPath = path.join(debDistDir, 'Packages');
		const packagesContentStr = modifiedLines.join('\n');
		fs.writeFileSync(packagesPath, packagesContentStr);
		execSync('gzip -k -f Packages', { cwd: debDistDir });
		console.log('Debian Packages and Packages.gz created.');

		// Generate Release file
		const packagesGzPath = path.join(debDistDir, 'Packages.gz');
		const getHashAndSize = (filePath) => {
			const content = fs.readFileSync(filePath);
			const hash = crypto.createHash('sha256').update(content).digest('hex');
			return { hash, size: content.length };
		};

		const pInfo = getHashAndSize(packagesPath);
		const pgInfo = getHashAndSize(packagesGzPath);

		const releaseContent = `Archive: stable
Component: main
Origin: Tauri App Template
Label: Tauri App Template
Architecture: amd64 arm64
Date: ${new Date().toUTCString()}
SHA256:
 ${pInfo.hash} ${pInfo.size} Packages
 ${pgInfo.hash} ${pgInfo.size} Packages.gz
`;
		fs.writeFileSync(path.join(debDistDir, 'Release'), releaseContent);

		// Sign Release files if GPG is available
		if (hasGpg) {
			console.log('Signing Debian Release files...');
			execSync(
				'gpg --yes --clearsign --default-key "Tauri App Template" -o InRelease Release',
				{ cwd: debDistDir },
			);
			execSync(
				'gpg --yes -abs --default-key "Tauri App Template" -o Release.gpg Release',
				{ cwd: debDistDir },
			);
			console.log('Debian Release signatures generated.');
		}
	} catch (err) {
		console.error('Failed to process Debian repository:', err.message);
	}

	// Remove temporary deb files
	for (const file of debFiles) {
		const tempPath = path.join(debDistDir, path.basename(file));
		if (fs.existsSync(tempPath)) {
			fs.unlinkSync(tempPath);
		}
	}
} else {
	console.log('No .deb files found in artifacts.');
}

// Copy list file to debDistDir
const sourceListPath = path.join(
	rootDir,
	'src-tauri/resources/tauri-app-template.list',
);
if (fs.existsSync(sourceListPath)) {
	fs.copyFileSync(
		sourceListPath,
		path.join(debDistDir, 'tauri-app-template.list'),
	);
}

// 2. Process RPM repository
console.log('Generating RPM YUM repository metadata...');
const rpmFiles = findFiles(artifactsDir, (f) => f.endsWith('.rpm'));
const rpmDistDir = path.join(distDir, 'rpm');
fs.mkdirSync(rpmDistDir, { recursive: true });

if (rpmFiles.length > 0) {
	const tempRpmDir = path.join(rootDir, 'temp_rpm');
	if (fs.existsSync(tempRpmDir)) {
		fs.rmSync(tempRpmDir, { recursive: true, force: true });
	}
	fs.mkdirSync(tempRpmDir, { recursive: true });

	for (const file of rpmFiles) {
		fs.copyFileSync(file, path.join(tempRpmDir, path.basename(file)));
	}

	try {
		console.log('Running createrepo_c...');
		execSync(
			`createrepo_c --baseurl https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v${version}/ .`,
			{
				cwd: tempRpmDir,
			},
		);

		// Move repodata to rpmDistDir
		if (fs.existsSync(path.join(tempRpmDir, 'repodata'))) {
			fs.renameSync(
				path.join(tempRpmDir, 'repodata'),
				path.join(rpmDistDir, 'repodata'),
			);
			console.log('RPM repository metadata generated.');

			// Sign repomd.xml if GPG is available
			if (hasGpg) {
				console.log('Signing RPM repomd.xml...');
				execSync(
					'gpg --yes --detach-sign --armor --default-key "Tauri App Template" -o repodata/repomd.xml.asc repodata/repomd.xml',
					{
						cwd: rpmDistDir,
					},
				);
				console.log('RPM repomd.xml signature created.');
			}
		}
	} catch (err) {
		console.error('Failed to run createrepo_c:', err.message);
	}

	// Clean up temp_rpm
	fs.rmSync(tempRpmDir, { recursive: true, force: true });
} else {
	console.log('No .rpm files found in artifacts.');
}

// Copy repo file to rpmDistDir
const sourceRepoPath = path.join(
	rootDir,
	'src-tauri/resources/tauri-app-template.repo',
);
if (fs.existsSync(sourceRepoPath)) {
	fs.copyFileSync(
		sourceRepoPath,
		path.join(rpmDistDir, 'tauri-app-template.repo'),
	);
}

console.log('All repository metadata work complete.');
