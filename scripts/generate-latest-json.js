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

const artifactsDir = path.join(__dirname, '../artifacts');
const platforms = {};

function getPlatformKey(filename, filePath) {
	const fileLower = filename.toLowerCase();
	const pathLower = filePath.toLowerCase();

	const isWindows =
		fileLower.includes('windows') ||
		fileLower.includes('nsis') ||
		pathLower.includes('windows') ||
		fileLower.includes('.zip');
	const isLinux =
		fileLower.includes('linux') ||
		fileLower.includes('appimage') ||
		pathLower.includes('linux') ||
		fileLower.includes('.tar.gz');
	const isArm64 =
		fileLower.includes('arm64') ||
		fileLower.includes('aarch64') ||
		pathLower.includes('arm64') ||
		pathLower.includes('aarch64');

	if (isWindows) {
		return isArm64 ? 'windows-aarch64' : 'windows-x86_64';
	} else if (isLinux) {
		return isArm64 ? 'linux-aarch64' : 'linux-x86_64';
	}
	return null;
}

function scanDir(dir) {
	if (!fs.existsSync(dir)) return;
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const fullPath = path.join(dir, file);
		const stat = fs.statSync(fullPath);
		if (stat.isDirectory()) {
			scanDir(fullPath);
		} else {
			if (file.endsWith('.zip') || file.endsWith('.tar.gz')) {
				const platform = getPlatformKey(file, fullPath);
				if (platform) {
					if (!platforms[platform]) platforms[platform] = {};
					platforms[platform].url =
						`https://github.com/RandomlyZay-Labs/tauri-app-template/releases/download/v${version}/${file}`;
					platforms[platform].filename = file;
				}
			} else if (file.endsWith('.zip.sig') || file.endsWith('.tar.gz.sig')) {
				const baseFile = file.slice(0, -4);
				const platform = getPlatformKey(baseFile, fullPath);
				if (platform) {
					if (!platforms[platform]) platforms[platform] = {};
					const sigContent = fs.readFileSync(fullPath, 'utf8').trim();
					platforms[platform].signature = sigContent;
				}
			}
		}
	}
}

scanDir(artifactsDir);

const cleanPlatforms = {};
for (const [platform, data] of Object.entries(platforms)) {
	if (data.url && data.signature) {
		cleanPlatforms[platform] = {
			url: data.url,
			signature: data.signature,
		};
	} else {
		console.error(
			`Error: Platform ${platform} is missing url or signature:`,
			data,
		);
		process.exit(1);
	}
}

const latestJson = {
	version,
	notes: `Release v${version}`,
	pub_date: new Date().toISOString(),
	platforms: cleanPlatforms,
};

fs.writeFileSync(
	path.join(artifactsDir, 'latest.json'),
	JSON.stringify(latestJson, null, 2),
);
console.log('Generated latest.json:', latestJson);
