import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

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
	execSync('gpg --armor --export "Tauri App Template" > dist/tauri-app-template.gpg', { cwd: rootDir });
	console.log('Public key exported to dist/tauri-app-template.gpg');
} catch {
	console.log('Warning: GPG key "Tauri App Template" not found. Repositories will not be signed.');
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
			execSync('gpg --yes --clearsign --default-key "Tauri App Template" -o InRelease Release', { cwd: debDistDir });
			execSync('gpg --yes -abs --default-key "Tauri App Template" -o Release.gpg Release', { cwd: debDistDir });
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
const sourceListPath = path.join(rootDir, 'src-tauri/resources/tauri-app-template.list');
if (fs.existsSync(sourceListPath)) {
	fs.copyFileSync(sourceListPath, path.join(debDistDir, 'tauri-app-template.list'));
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
		execSync(`createrepo_c --baseurl https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v${version}/ .`, {
			cwd: tempRpmDir,
		});

		// Move repodata to rpmDistDir
		if (fs.existsSync(path.join(tempRpmDir, 'repodata'))) {
			fs.renameSync(path.join(tempRpmDir, 'repodata'), path.join(rpmDistDir, 'repodata'));
			console.log('RPM repository metadata generated.');

			// Sign repomd.xml if GPG is available
			if (hasGpg) {
				console.log('Signing RPM repomd.xml...');
				execSync('gpg --yes --detach-sign --armor --default-key "Tauri App Template" -o repodata/repomd.xml.asc repodata/repomd.xml', {
					cwd: rpmDistDir,
				});
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
const sourceRepoPath = path.join(rootDir, 'src-tauri/resources/tauri-app-template.repo');
if (fs.existsSync(sourceRepoPath)) {
	fs.copyFileSync(sourceRepoPath, path.join(rpmDistDir, 'tauri-app-template.repo'));
}

// 3. Generate Landing Page HTML
console.log('Generating download landing page...');

// Collect all uploaded artifact names
const allFiles = findFiles(artifactsDir, (f) => !f.endsWith('.sig') && !f.endsWith('.json') && !f.endsWith('.sha256'));
const fileMap = {};
for (const file of allFiles) {
	const baseName = path.basename(file);
	fileMap[baseName] = `https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v${version}/${baseName}`;
}

const landingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Download Tauri App Template</title>
	<meta name="description" content="Download the latest version of Tauri App Template. Flat repositories for Debian and RPM are also available.">
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
	<style>
		:root {
			--bg-color: #09090b;
			--card-bg: rgba(24, 24, 27, 0.6);
			--border-color: rgba(63, 63, 70, 0.4);
			--text-color: #f4f4f5;
			--text-muted: #a1a1aa;
			--primary: #10b981;
			--primary-hover: #059669;
			--primary-glow: rgba(16, 185, 129, 0.15);
			--font-sans: 'Outfit', sans-serif;
			--duration-normal: 200ms;
		}

		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		body {
			background-color: var(--bg-color);
			color: var(--text-color);
			font-family: var(--font-sans);
			line-height: 1.5;
			display: flex;
			flex-direction: column;
			min-height: 100vh;
			align-items: center;
			justify-content: center;
			padding: 2rem 1rem;
			background-image: 
				radial-gradient(circle at 50% -20%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
				radial-gradient(circle at 10% 80%, rgba(16, 185, 129, 0.02) 0%, transparent 30%);
		}

		.container {
			max-width: 800px;
			width: 100%;
			background: var(--card-bg);
			border: 1px solid var(--border-color);
			backdrop-filter: blur(12px);
			border-radius: 1rem;
			padding: 2.5rem;
			box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
		}

		header {
			text-align: center;
			margin-bottom: 2.5rem;
		}

		h1 {
			font-size: 2.25rem;
			font-weight: 700;
			letter-spacing: -0.025em;
			margin-bottom: 0.5rem;
			background: linear-gradient(135deg, #fff 0%, var(--text-muted) 100%);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
		}

		.version-badge {
			display: inline-block;
			background: rgba(16, 185, 129, 0.1);
			color: var(--primary);
			border: 1px solid rgba(16, 185, 129, 0.2);
			padding: 0.25rem 0.75rem;
			border-radius: 9999px;
			font-size: 0.875rem;
			font-weight: 600;
		}

		.detected-os-section {
			text-align: center;
			margin-bottom: 3rem;
			padding: 2rem;
			background: rgba(255, 255, 255, 0.02);
			border-radius: 0.75rem;
			border: 1px solid rgba(255, 255, 255, 0.05);
		}

		.detected-title {
			font-size: 0.875rem;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--text-muted);
			margin-bottom: 1rem;
		}

		.btn-primary {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			background-color: var(--primary);
			color: #000;
			font-weight: 600;
			text-decoration: none;
			padding: 0.875rem 2rem;
			border-radius: 0.5rem;
			font-size: 1.125rem;
			transition: all var(--duration-normal) ease;
			box-shadow: 0 0 20px var(--primary-glow);
		}

		.btn-primary:hover {
			background-color: var(--primary-hover);
			transform: translateY(-2px);
			box-shadow: 0 0 25px rgba(16, 185, 129, 0.3);
		}

		.btn-primary:active {
			transform: translateY(0);
		}

		.grid-section-title {
			font-size: 1.125rem;
			font-weight: 600;
			margin-bottom: 1rem;
			border-bottom: 1px solid var(--border-color);
			padding-bottom: 0.5rem;
			color: var(--text-color);
		}

		.download-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
			gap: 1.5rem;
			margin-bottom: 2.5rem;
		}

		.download-card {
			background: rgba(255, 255, 255, 0.02);
			border: 1px solid rgba(255, 255, 255, 0.05);
			border-radius: 0.5rem;
			padding: 1.25rem;
			display: flex;
			flex-direction: column;
		}

		.download-card h3 {
			font-size: 1rem;
			font-weight: 600;
			margin-bottom: 0.75rem;
		}

		.download-card-links {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		.download-link {
			color: var(--primary);
			text-decoration: none;
			font-size: 0.875rem;
			transition: color var(--duration-normal);
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
		}

		.download-link:hover {
			color: var(--primary-hover);
			text-decoration: underline;
		}

		.repo-section {
			background: rgba(255, 255, 255, 0.01);
			border: 1px solid var(--border-color);
			border-radius: 0.75rem;
			padding: 1.5rem;
			margin-top: 2rem;
		}

		.repo-title {
			font-size: 1.125rem;
			font-weight: 600;
			margin-bottom: 1rem;
			color: var(--primary);
		}

		.repo-tabs {
			display: flex;
			gap: 0.5rem;
			margin-bottom: 1rem;
			border-bottom: 1px solid var(--border-color);
			padding-bottom: 0.5rem;
		}

		.repo-tab {
			background: none;
			border: none;
			color: var(--text-muted);
			font-family: var(--font-sans);
			font-size: 0.875rem;
			cursor: pointer;
			padding: 0.25rem 0.5rem;
			border-radius: 0.25rem;
			transition: all var(--duration-normal);
		}

		.repo-tab.active {
			color: var(--primary);
			background: rgba(16, 185, 129, 0.1);
		}

		.code-block {
			background: #18181b;
			border: 1px solid rgba(255, 255, 255, 0.05);
			border-radius: 0.375rem;
			padding: 1rem;
			font-family: monospace;
			font-size: 0.875rem;
			overflow-x: auto;
			white-space: pre;
			display: none;
		}

		.code-block.active {
			display: block;
		}

		footer {
			margin-top: 2.5rem;
			text-align: center;
			font-size: 0.75rem;
			color: var(--text-muted);
		}

		footer a {
			color: var(--text-color);
			text-decoration: none;
		}

		footer a:hover {
			text-decoration: underline;
		}
	</style>
</head>
<body>
	<div class="container">
		<header>
			<h1>Tauri App Template</h1>
			<span class="version-badge">v${version}</span>
		</header>

		<div class="detected-os-section">
			<div class="detected-title" id="detected-os-title">Detecting operating system...</div>
			<a href="#" class="btn-primary" id="detected-os-btn" style="display: none;">Download Installer</a>
		</div>

		<h2 class="grid-section-title">All Downloads</h2>
		<div class="download-grid">
			<!-- Windows -->
			<div class="download-card">
				<h3>Windows</h3>
				<div class="download-card-links">
					${
						fileMap[`tauri-app-template_${version}_x64-setup.exe`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template_${version}_x64-setup.exe`]
								}">Installer (x64)</a>`
							: ''
					}
					${
						fileMap[`tauri-app-template_${version}_arm64-setup.exe`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template_${version}_arm64-setup.exe`]
								}">Installer (ARM64)</a>`
							: ''
					}
				</div>
			</div>

			<!-- Linux Debian/Ubuntu -->
			<div class="download-card">
				<h3>Debian / Ubuntu</h3>
				<div class="download-card-links">
					${
						fileMap[`tauri-app-template_${version}_amd64.deb`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template_${version}_amd64.deb`]
								}">DEB Package (amd64)</a>`
							: ''
					}
					${
						fileMap[`tauri-app-template_${version}_arm64.deb`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template_${version}_arm64.deb`]
								}">DEB Package (arm64)</a>`
							: ''
					}
				</div>
			</div>

			<!-- Linux Fedora/RHEL -->
			<div class="download-card">
				<h3>Fedora / RHEL</h3>
				<div class="download-card-links">
					${
						fileMap[`tauri-app-template-${version}-x86_64.rpm`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template-${version}-x86_64.rpm`]
								}">RPM Package (x86_64)</a>`
							: ''
					}
					${
						fileMap[`tauri-app-template-${version}-aarch64.rpm`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template-${version}-aarch64.rpm`]
								}">RPM Package (aarch64)</a>`
							: ''
					}
				</div>
			</div>

			<!-- Linux AppImage -->
			<div class="download-card">
				<h3>AppImage</h3>
				<div class="download-card-links">
					${
						fileMap[`tauri-app-template_${version}_amd64.AppImage`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template_${version}_amd64.AppImage`]
								}">AppImage (amd64)</a>`
							: ''
					}
					${
						fileMap[`tauri-app-template_${version}_arm64.AppImage`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template_${version}_arm64.AppImage`]
								}">AppImage (arm64)</a>`
							: ''
					}
				</div>
			</div>

			<!-- CLI Developer tool -->
			<div class="download-card">
				<h3>Developer CLI</h3>
				<div class="download-card-links">
					${
						fileMap[`tauri-app-template-cli-windows-x64.exe`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template-cli-windows-x64.exe`]
								}">Windows CLI (x64)</a>`
							: ''
					}
					${
						fileMap[`tauri-app-template-cli-windows-arm64.exe`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template-cli-windows-arm64.exe`]
								}">Windows CLI (ARM64)</a>`
							: ''
					}
					${
						fileMap[`tauri-app-template-cli-linux-amd64`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template-cli-linux-amd64`]
								}">Linux CLI (amd64)</a>`
							: ''
					}
					${
						fileMap[`tauri-app-template-cli-linux-arm64`]
							? `<a class="download-link" href="${
									fileMap[`tauri-app-template-cli-linux-arm64`]
								}">Linux CLI (arm64)</a>`
							: ''
					}
				</div>
			</div>
		</div>

		<div class="repo-section">
			<h2 class="repo-title">Linux Package Repositories</h2>
			<div class="repo-tabs">
				<button class="repo-tab active" onclick="switchRepo('debian')">Ubuntu / Debian</button>
				<button class="repo-tab" onclick="switchRepo('fedora')">Fedora / RHEL</button>
			</div>
			<div class="code-block active" id="code-debian"># Trust key and add repository
sudo mkdir -p /etc/apt/keyrings
sudo curl -fsSL https://randomlyzay-labs.github.io/tauri-app-template/tauri-app-template.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/tauri-app-template.gpg
sudo curl -sLo /etc/apt/sources.list.d/tauri-app-template.list https://randomlyzay-labs.github.io/tauri-app-template/debian/tauri-app-template.list

# Update package index and install
sudo apt-get update
sudo apt-get install tauri-app-template</div>
			<div class="code-block" id="code-fedora"># Add repository config directly
sudo curl -sLo /etc/yum.repos.d/tauri-app-template.repo https://randomlyzay-labs.github.io/tauri-app-template/rpm/tauri-app-template.repo

# Install package
sudo dnf install tauri-app-template</div>
		</div>

		<footer>
			<p>View source code on <a href="https://github.com/RandomlyZay-Labs/tauri-app-template">GitHub</a></p>
		</footer>
	</div>

	<script>
		// OS Detection
		const userAgent = navigator.userAgent.toLowerCase();
		const titleEl = document.getElementById('detected-os-title');
		const btnEl = document.getElementById('detected-os-btn');

		let downloadUrl = '';
		let osName = '';

		if (userAgent.includes('win')) {
			osName = 'Windows';
			downloadUrl = '${fileMap[`tauri-app-template_${version}_x64-setup.exe`] || '#'}';
		} else if (userAgent.includes('deb') || userAgent.includes('ubuntu')) {
			osName = 'Debian/Ubuntu';
			downloadUrl = '${fileMap[`tauri-app-template_${version}_amd64.deb`] || '#'}';
		} else if (userAgent.includes('fedora') || userAgent.includes('redhat') || userAgent.includes('centos')) {
			osName = 'Fedora/RHEL';
			downloadUrl = '${fileMap[`tauri-app-template-${version}-x86_64.rpm`] || '#'}';
		} else if (userAgent.includes('linux')) {
			osName = 'Linux';
			downloadUrl = '${fileMap[`tauri-app-template_${version}_amd64.AppImage`] || '#'}';
		}

		if (osName && downloadUrl !== '#') {
			titleEl.textContent = 'Detected Operating System: ' + osName;
			btnEl.href = downloadUrl;
			btnEl.textContent = 'Download for ' + osName;
			btnEl.style.display = 'inline-flex';
		} else {
			titleEl.textContent = 'Select a platform below to download';
		}

		// Repository command tabs
		function switchRepo(type) {
			document.querySelectorAll('.repo-tab').forEach(btn => btn.classList.remove('active'));
			document.querySelectorAll('.code-block').forEach(block => block.classList.remove('active'));

			if (type === 'debian') {
				document.querySelector('.repo-tab:nth-child(1)').classList.add('active');
				document.getElementById('code-debian').classList.add('active');
			} else {
				document.querySelector('.repo-tab:nth-child(2)').classList.add('active');
				document.getElementById('code-fedora').classList.add('active');
			}
		}
	</script>
</body>
</html>
`;

fs.writeFileSync(path.join(distDir, 'index.html'), landingHtml);
console.log('Landing page generated at dist/index.html');
console.log('All repository work complete.');
