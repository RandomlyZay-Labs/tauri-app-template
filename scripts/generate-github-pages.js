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

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true });
}

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

console.log('Generating download landing page...');

// Collect all uploaded artifact names
const allFiles = findFiles(
	artifactsDir,
	(f) => !f.endsWith('.sig') && !f.endsWith('.json') && !f.endsWith('.sha256'),
);

const fileMap = {};
for (const file of allFiles) {
	const baseName = path.basename(file);
	fileMap[baseName] =
		`https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v${version}/${baseName}`;
}

// Load landing page HTML template
const templatePath = path.join(__dirname, 'landing.html');
if (!fs.existsSync(templatePath)) {
	console.error(`Error: Template not found at ${templatePath}`);
	process.exit(1);
}

let html = fs.readFileSync(templatePath, 'utf8');

const winUrl = fileMap[`tauri-app-template_${version}_x64-setup.exe`] || '#';
const debUrl = fileMap[`tauri-app-template_${version}_amd64.deb`] || '#';
const rpmUrl = fileMap[`tauri-app-template-${version}-x86_64.rpm`] || '#';
const appImageUrl =
	fileMap[`tauri-app-template_${version}_amd64.appimage`] || '#';

// Replace base placeholders
html = html
	.replaceAll('{{VERSION}}', version)
	.replaceAll('&#123;&#123;VERSION&#125;&#125;', version)
	.replaceAll('{{DETECT_WIN_URL}}', winUrl)
	.replaceAll('{{DETECT_DEB_URL}}', debUrl)
	.replaceAll('{{DETECT_RPM_URL}}', rpmUrl)
	.replaceAll('{{DETECT_APPIMAGE_URL}}', appImageUrl);

// Replace link placeholders: <!-- {{LINK:filename:label}} -->
const linkRegex = /<!--\s*\{\{LINK:(.*?):(.*?)\}\}\s*-->/g;
html = html.replace(linkRegex, (filenameTemplate, label) => {
	const filename = filenameTemplate.replaceAll('VERSION', version);
	const url = fileMap[filename];
	if (url) {
		return `<a class="download-link" href="${url}">${label}</a>`;
	}
	return '';
});

fs.writeFileSync(path.join(distDir, 'index.html'), html);
console.log('Landing page generated at dist/index.html');
