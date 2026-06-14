// SPDX-License-Identifier: MIT

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let targetDirCreated = null;
let ghRepoCreated = null;
let coprRepoCreated = null;

// Colors for terminal output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	red: '\x1b[31m',
};

const IGNORED_PATHS = [
	'.git',
	'node_modules',
	'target',
	'dist',
	'dev_data',
	'playwright-report',
	'test-results',
	'.env',
	'setup.js',
];

function isIgnored(relativePath) {
	return relativePath
		.split(path.sep)
		.some((segment) => IGNORED_PATHS.includes(segment));
}

// Readline setup for interactive prompts
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const askQuestion = (query) =>
	new Promise((resolve) => rl.question(query, resolve));

// Helper to run a command and capture output, printing only on failure
function runCommand(command, cwd = process.cwd(), options = {}) {
	try {
		const result = execSync(command, {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			...options,
		});
		return { success: true, stdout: result ? result.toString() : '' };
	} catch (err) {
		return {
			success: false,
			stdout: err.stdout ? err.stdout.toString() : '',
			stderr: err.stderr ? err.stderr.toString() : '',
			error: err,
		};
	}
}

// Helper to run a command or throw an error on failure
async function runCommandOrThrow(command, cwd, errorMessage) {
	while (true) {
		const res = runCommand(command, cwd);
		if (res.success) {
			return;
		}
		console.error(
			`\n${colors.red}❌ Error: ${errorMessage || `Command failed: ${command}`}${colors.reset}`,
		);
		const details = (
			res.stderr ||
			res.stdout ||
			res.error.message ||
			''
		).trim();
		if (details) {
			console.error(`${colors.red}Details:${colors.reset}\n${details}\n`);
		}
		const answer = await askQuestion(
			`Choose action:\n  1. Retry command\n  2. Ignore error and continue\n  3. Abort/Exit setup\nEnter choice (1/2/3) [default: 1]: `,
		);
		const choice = answer.trim();
		if (choice === '2') {
			console.log(
				`${colors.yellow}⚠️ Ignored error. Continuing...${colors.reset}`,
			);
			return;
		} else if (choice === '3') {
			throw new Error(errorMessage || `Command failed: ${command}`);
		}
		console.log(`${colors.cyan}Retrying: ${command}...${colors.reset}`);
	}
}

// Helper to check if a command/tool is installed
function isToolInstalled(name) {
	try {
		const checkCmd = process.platform === 'win32' ? 'where' : 'which';
		execSync(`${checkCmd} ${name}`, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

// Helper to check if file is binary
function isBinaryFile(filePath) {
	try {
		const fd = fs.openSync(filePath, 'r');
		const buffer = Buffer.alloc(512);
		const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
		fs.closeSync(fd);
		for (let i = 0; i < bytesRead; i++) {
			if (buffer[i] === 0) return true;
		}
		return false;
	} catch {
		return false;
	}
}

function escapeRegExp(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Copy folder recursively ignoring specified paths
function copyFolderRecursive(srcDir, destDir) {
	fs.mkdirSync(destDir, { recursive: true });
	const files = fs.readdirSync(srcDir);
	for (const file of files) {
		const srcPath = path.join(srcDir, file);
		const destPath = path.join(destDir, file);
		const relativePath = path.relative(__dirname, srcPath);

		if (isIgnored(relativePath)) {
			continue;
		}

		const stat = fs.statSync(srcPath);
		if (stat.isDirectory()) {
			copyFolderRecursive(srcPath, destPath);
		} else if (stat.isFile()) {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

// Derive casing variants from name input
function getCasingVariants(input) {
	const words = input
		.replace(/[-_]+/g, ' ')
		.replace(/([A-Z][a-z])/g, ' $1')
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	const title = words
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(' ');
	const kebab = words.map((w) => w.toLowerCase()).join('-');
	const snake = words.map((w) => w.toLowerCase()).join('_');
	const constant = words.map((w) => w.toUpperCase()).join('_');
	const pascal = words
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join('');
	const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);

	return { title, kebab, snake, constant, pascal, camel };
}

// Get authenticated GitHub username via gh CLI
function getGhUsername() {
	try {
		return execSync('gh api user --jq .login', {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		}).trim();
	} catch {
		return null;
	}
}

async function main() {
	const isLinux = process.platform === 'linux';
	console.log(
		`\n${colors.magenta}${colors.bright}🔮 Tauri App Initializer & Setup${colors.reset}\n`,
	);

	// --- 1. ENVIRONMENT CHECKS ---
	console.log(`${colors.cyan}🔍 Checking core environment...${colors.reset}`);
	const coreTools = ['git', 'pnpm', 'cargo', 'sqlx'];
	const missingCore = [];

	for (const tool of coreTools) {
		if (!isToolInstalled(tool)) {
			missingCore.push(tool);
		}
	}

	if (missingCore.length > 0) {
		console.error(
			`\n${colors.red}❌ Error: The following required tools are missing or not in PATH:${colors.reset}`,
		);
		for (const tool of missingCore) {
			console.error(`  - ${tool}`);
			if (tool === 'sqlx') {
				console.error(
					`    👉 Install via: cargo install sqlx-cli --no-default-features --features sqlite`,
				);
			}
		}
		const proceedInput = await askQuestion(
			`\n${colors.bright}Do you want to ignore this and proceed with setup anyway? (y/N) [default: n]: ${colors.reset}`,
		);
		if (proceedInput.trim().toLowerCase() !== 'y') {
			rl.close();
			process.exit(1);
		}
	} else {
		console.log(
			`${colors.green}✅ Core environment checks passed.${colors.reset}\n`,
		);
	}

	// --- 2. GATHER CONFIGURATION ---
	let appNameInput = '';
	while (true) {
		appNameInput = await askQuestion(
			`${colors.bright}What will the app name be? ${colors.reset}`,
		);
		if (!appNameInput.trim()) {
			console.error(
				`${colors.red}❌ Error: Project name cannot be empty. Please enter a name.${colors.reset}`,
			);
		} else {
			break;
		}
	}

	const casings = getCasingVariants(appNameInput);
	console.log(`\n${colors.cyan}Derived Casing Variants:${colors.reset}`);
	console.log(`  - Title:    ${colors.green}${casings.title}${colors.reset}`);
	console.log(`  - Kebab:    ${colors.green}${casings.kebab}${colors.reset}`);
	console.log(`  - Snake:    ${colors.green}${casings.snake}${colors.reset}`);
	console.log(`  - Pascal:   ${colors.green}${casings.pascal}${colors.reset}`);
	console.log(`  - Camel:    ${colors.green}${casings.camel}${colors.reset}`);
	console.log(
		`  - Constant: ${colors.green}${casings.constant}${colors.reset}\n`,
	);

	// Casing selection for project folder
	console.log(
		`${colors.bright}Choose casing style for the project folder name:${colors.reset}`,
	);
	console.log(
		`  1. kebab-case (${colors.green}${casings.kebab}${colors.reset})`,
	);
	console.log(
		`  2. snake_case (${colors.green}${casings.snake}${colors.reset})`,
	);
	console.log(
		`  3. PascalCase (${colors.green}${casings.pascal}${colors.reset})`,
	);
	console.log(
		`  4. camelCase (${colors.green}${casings.camel}${colors.reset})`,
	);
	console.log(
		`  5. CONSTANT_CASE (${colors.green}${casings.constant}${colors.reset})`,
	);
	const casingChoiceInput = await askQuestion(
		`${colors.bright}Enter choice (1/2/3/4/5) [default: 1]: ${colors.reset}`,
	);

	let folderName = casings.kebab;
	if (casingChoiceInput.trim() === '2') {
		folderName = casings.snake;
	} else if (casingChoiceInput.trim() === '3') {
		folderName = casings.pascal;
	} else if (casingChoiceInput.trim() === '4') {
		folderName = casings.camel;
	} else if (casingChoiceInput.trim() === '5') {
		folderName = casings.constant;
	}

	// Target Directory Setup
	let targetDir = '';
	while (true) {
		const defaultTargetDir = path.join(os.homedir(), 'Projects', folderName);
		const targetInput = await askQuestion(
			`${colors.bright}Enter target directory [default: ${defaultTargetDir}]: ${colors.reset}`,
		);
		targetDir = path.resolve(targetInput.trim() || defaultTargetDir);

		if (fs.existsSync(targetDir)) {
			console.error(
				`${colors.red}❌ Error: Directory already exists at: ${targetDir}. Please choose another path.${colors.reset}`,
			);
		} else {
			break;
		}
	}

	// Detect git remote & GitHub username
	const ghUser = getGhUsername();
	const defaultOwner = ghUser || os.userInfo().username;
	const defaultRepo = casings.kebab;

	const ownerInput = await askQuestion(
		`${colors.bright}Enter GitHub Owner/Org [default: ${defaultOwner}]: ${colors.reset}`,
	);
	const owner = ownerInput.trim() || defaultOwner;

	const repoInput = await askQuestion(
		`${colors.bright}Enter GitHub Repository Name [default: ${defaultRepo}]: ${colors.reset}`,
	);
	const repoName = repoInput.trim() || defaultRepo;

	let coprUsername = owner.toLowerCase();
	if (isLinux) {
		const coprUserInput = await askQuestion(
			`${colors.bright}Enter Fedora COPR Username [default: ${owner.toLowerCase()}]: ${colors.reset}`,
		);
		coprUsername = coprUserInput.trim() || owner.toLowerCase();
	}

	// CI/CD Option
	const ciPrompt = isLinux
		? `\n${colors.bright}Do you want to automate GitHub Secrets and Fedora COPR configuration? (y/N) [default: n]: ${colors.reset}`
		: `\n${colors.bright}Do you want to automate GitHub Secrets configuration? (y/N) [default: n]: ${colors.reset}`;
	const ciSetupInput = await askQuestion(ciPrompt);
	const setupCi = ciSetupInput.trim().toLowerCase() === 'y';

	// --- 3. COPY FILES ---
	console.log(
		`\n${colors.cyan}📂 Copying template files to ${targetDir}...${colors.reset}`,
	);
	copyFolderRecursive(__dirname, targetDir);
	targetDirCreated = targetDir;
	console.log(`${colors.green}✅ Files copied.${colors.reset}`);

	// --- 4. REPLACEMENTS & RENAMING ---
	console.log(
		`\n${colors.cyan}📝 Replacing project references in text files...${colors.reset}`,
	);

	const replacements = {
		'Tauri App Template': casings.title,
		TauriAppTemplate: casings.pascal,
		TAURI_APP_TEMPLATE: casings.constant,
		tauri_app_template: casings.snake,
		'tauri-app-template': casings.kebab,
		'RandomlyZay-Labs': owner,
		'randomlyzay-labs': owner.toLowerCase(),
		randomlyzay: coprUsername,
	};

	// Replace file contents
	function replaceContents(dir) {
		const files = fs.readdirSync(dir);
		for (const file of files) {
			const fullPath = path.join(dir, file);
			const relativePath = path.relative(targetDir, fullPath);

			if (isIgnored(relativePath)) {
				continue;
			}

			const stat = fs.statSync(fullPath);
			if (stat.isDirectory()) {
				replaceContents(fullPath);
			} else if (stat.isFile()) {
				if (isBinaryFile(fullPath)) continue;

				let content = fs.readFileSync(fullPath, 'utf8');
				let changed = false;

				// Preserve tauri-builder registry URL
				const placeholder = '___TAURI_BUILDER_REGISTRY___';
				const hasBuilderImg =
					content.includes('ghcr.io/randomlyzay-labs/tauri-builder') ||
					content.includes('ghcr.io/RandomlyZay-Labs/tauri-builder');
				if (hasBuilderImg) {
					content = content.replace(
						/ghcr\.io\/(randomlyzay-labs|RandomlyZay-Labs)\/tauri-builder/g,
						placeholder,
					);
				}

				for (const [search, replace] of Object.entries(replacements)) {
					const regex = new RegExp(escapeRegExp(search), 'g');
					if (regex.test(content)) {
						content = content.replace(regex, replace);
						changed = true;
					}
				}

				if (hasBuilderImg) {
					content = content.replace(
						new RegExp(placeholder, 'g'),
						'ghcr.io/randomlyzay-labs/tauri-builder',
					);
					changed = true;
				}

				if (changed) {
					fs.writeFileSync(fullPath, content, 'utf8');
				}
			}
		}
	}

	replaceContents(targetDir);
	console.log(`${colors.green}✅ Content references updated.${colors.reset}`);

	console.log(
		`\n${colors.cyan}🔄 Renaming project files and folders...${colors.reset}`,
	);
	// Collect and rename paths
	const allPaths = [];
	function collectPaths(dir) {
		const files = fs.readdirSync(dir);
		for (const file of files) {
			const fullPath = path.join(dir, file);
			const relativePath = path.relative(targetDir, fullPath);

			if (isIgnored(relativePath)) {
				continue;
			}

			allPaths.push(fullPath);
			if (fs.statSync(fullPath).isDirectory()) {
				collectPaths(fullPath);
			}
		}
	}

	collectPaths(targetDir);
	// Sort descending by depth (number of segments) so child items are renamed before parents
	allPaths.sort((a, b) => {
		const depthA = a.split(path.sep).length;
		const depthB = b.split(path.sep).length;
		if (depthB !== depthA) {
			return depthB - depthA;
		}
		return b.length - a.length;
	});

	for (const oldPath of allPaths) {
		const parentDir = path.dirname(oldPath);
		const fileName = path.basename(oldPath);
		let newFileName = fileName;

		for (const [search, replace] of Object.entries(replacements)) {
			newFileName = newFileName.replace(
				new RegExp(escapeRegExp(search), 'g'),
				replace,
			);
		}

		if (newFileName !== fileName) {
			const newPath = path.join(parentDir, newFileName);
			fs.renameSync(oldPath, newPath);
		}
	}
	console.log(`${colors.green}✅ File renaming complete.${colors.reset}`);

	// --- 5. GIT INITIALIZATION ---
	console.log(
		`\n${colors.cyan}🔧 Initializing git repository...${colors.reset}`,
	);
	await runCommandOrThrow(
		'git init',
		targetDir,
		'Failed to initialize git repository',
	);
	await runCommandOrThrow(
		'git checkout -b dev',
		targetDir,
		'Failed to switch to dev branch',
	);
	await runCommandOrThrow(
		`git remote add origin https://github.com/${owner}/${repoName}.git`,
		targetDir,
		'Failed to add git remote origin',
	);
	console.log(
		`${colors.green}✅ Git repository initialized with dev branch and remote origin set.${colors.reset}`,
	);

	// --- 6. AUTOMATED CI/CD SETUP ---
	if (setupCi) {
		console.log(
			`\n${colors.cyan}🔑 Configuring Keys & Secrets...${colors.reset}`,
		);
		const ciTools = isLinux ? ['gh', 'gpg', 'copr-cli'] : ['gh', 'gpg'];
		const missingCi = ciTools.filter((t) => !isToolInstalled(t));

		if (missingCi.length > 0) {
			console.error(
				`\n${colors.red}❌ Error: Missing required CI/CD tools: ${missingCi.join(', ')}${colors.reset}`,
			);
			console.error(`Please install them before running setup again:`);
			for (const tool of missingCi) {
				if (tool === 'gh') {
					console.error(
						`  - gh: Install GitHub CLI (e.g., 'sudo apt install gh', 'sudo dnf install gh', or 'brew install gh')`,
					);
				} else if (tool === 'gpg') {
					console.error(
						`  - gpg: Install GnuPG (e.g., 'sudo apt install gnupg', 'sudo dnf install gnupg', or 'brew install gnupg')`,
					);
				} else if (tool === 'copr-cli') {
					console.error(
						`  - copr-cli: Install copr-cli (e.g., 'sudo apt install copr-cli' or 'sudo dnf install copr-cli')`,
					);
				}
			}
			throw new Error('Missing required CI/CD tools');
		} else {
			// 1. Verify GitHub CLI authentication
			let ghAuthed = false;
			while (!ghAuthed) {
				try {
					execSync('gh auth status', { stdio: 'ignore' });
					ghAuthed = true;
				} catch {
					console.log(
						`\n${colors.yellow}⚠️ GitHub CLI is not logged in.${colors.reset}`,
					);
					const answer = await askQuestion(
						`Please authenticate by running 'gh auth login' in another terminal.\nPress Enter to retry, or type 'exit' to abort setup: `,
					);
					if (answer.trim().toLowerCase() === 'exit') {
						throw new Error(
							'User aborted setup due to missing GitHub CLI authentication',
						);
					}
				}
			}

			// 2. Verify Fedora COPR CLI authentication
			let skipCopr = false;
			if (isLinux) {
				let coprAuthed = false;
				while (!coprAuthed && !skipCopr) {
					try {
						execSync('copr-cli whoami', { stdio: 'ignore' });
						coprAuthed = true;
					} catch {
						console.log(
							`\n${colors.yellow}⚠️ Fedora COPR CLI is not authenticated.${colors.reset}`,
						);
						console.log(
							`Please obtain your API token from: https://copr.fedorainfracloud.org/api/`,
						);
						console.log(`and save the configuration to ~/.config/copr.`);
						const answer = await askQuestion(
							`Choose action:\n  1. Retry checking\n  2. Skip Fedora COPR configuration\n  3. Abort/Exit setup\nEnter choice (1/2/3) [default: 1]: `,
						);
						const choice = answer.trim();
						if (choice === '2') {
							skipCopr = true;
							console.log(
								`${colors.yellow}⚠️ Skipping Fedora COPR configuration.${colors.reset}`,
							);
						} else if (choice === '3') {
							throw new Error(
								'User aborted setup due to missing Fedora COPR CLI authentication',
							);
						}
					}
				}
			}

			if (ghAuthed) {
				// GitHub Repository Visibility
				const visibilityInput = await askQuestion(
					`Should the GitHub repository be public or private? (public/private) [default: public]: `,
				);
				const isPrivate = visibilityInput.trim().toLowerCase() === 'private';
				const visibilityFlag = isPrivate ? '--private' : '--public';

				// Check if remote repo exists, if not create it
				console.log(
					`Checking if GitHub repository ${owner}/${repoName} exists...`,
				);
				let repoExists = false;
				try {
					execSync(`gh repo view ${owner}/${repoName}`, { stdio: 'ignore' });
					repoExists = true;
				} catch {
					// Repo does not exist
				}

				if (repoExists) {
					console.log(
						`\n${colors.yellow}⚠️ GitHub repository ${owner}/${repoName} already exists.${colors.reset}`,
					);
					const answer = await askQuestion(
						`Choose action:\n  1. Delete the repo and recreate it from scratch\n  2. Cancel setup\nEnter choice (1/2) [default: 2]: `,
					);
					if (answer.trim() === '1') {
						console.log(`Deleting GitHub repository ${owner}/${repoName}...`);
						const delRes = runCommand(
							`gh repo delete ${owner}/${repoName} --yes`,
						);
						if (!delRes.success) {
							console.warn(
								`${colors.yellow}⚠️ Warning: Failed to delete GitHub repository: ${delRes.stderr || delRes.stdout}${colors.reset}`,
							);
						}
						console.log(`Creating GitHub repository ${owner}/${repoName}...`);
						const createRes = runCommand(
							`gh repo create ${owner}/${repoName} ${visibilityFlag}`,
							targetDir,
						);
						if (!createRes.success) {
							throw new Error(
								createRes.stderr ||
									createRes.stdout ||
									'Failed to create GitHub repository',
							);
						}
						ghRepoCreated = `${owner}/${repoName}`;
						console.log(
							`${colors.green}✅ GitHub repository recreated.${colors.reset}`,
						);
					} else {
						throw new Error(
							`User aborted setup: GitHub repository already exists.`,
						);
					}
				} else {
					console.log(`Creating GitHub repository ${owner}/${repoName}...`);
					const createRes = runCommand(
						`gh repo create ${owner}/${repoName} ${visibilityFlag}`,
						targetDir,
					);
					if (createRes.success) {
						ghRepoCreated = `${owner}/${repoName}`;
						console.log(
							`${colors.green}✅ GitHub repository created.${colors.reset}`,
						);
					} else {
						console.warn(
							`${colors.yellow}⚠️ Warning: Failed to create GitHub repository: ${(createRes.stderr || createRes.stdout || createRes.error.message || '').trim()}${colors.reset}`,
						);
					}
				}

				// Configure GitHub Release Token
				try {
					console.log(
						`\n${colors.cyan}🔑 Configuring GitHub Release Token (RELEASE_TOKEN)...${colors.reset}`,
					);
					const token = execSync('gh auth token', {
						encoding: 'utf8',
						stdio: ['ignore', 'pipe', 'pipe'],
					}).trim();
					if (token) {
						console.log(`Uploading RELEASE_TOKEN secret...`);
						execSync('gh secret set RELEASE_TOKEN', {
							input: token,
							cwd: targetDir,
						});
						console.log(
							`${colors.green}✅ RELEASE_TOKEN secret set.${colors.reset}`,
						);
					} else {
						throw new Error('No authentication token returned by gh CLI');
					}
				} catch (err) {
					console.warn(
						`${colors.yellow}⚠️ Warning: Failed to automatically set RELEASE_TOKEN secret: ${err.message}${colors.reset}`,
					);
				}

				// Generate Tauri Signing Key
				console.log(
					`\n${colors.cyan}🔑 Configuring Tauri Signing Keys...${colors.reset}`,
				);
				const keyPassword = await askQuestion(
					`Enter a password/passphrase for the Tauri private key (leave empty for no password): `,
				);

				try {
					const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
					const keyGenResult = spawnSync(
						pnpmCmd,
						['tauri', 'signer', 'generate', '-p', keyPassword],
						{
							encoding: 'utf8',
							stdio: ['ignore', 'pipe', 'pipe'],
						},
					);

					if (keyGenResult.status !== 0) {
						throw new Error(keyGenResult.stderr || 'Signer generation failed');
					}

					const keyGenOut = keyGenResult.stdout || '';

					let privateBase64 = '';
					let publicBase64 = '';
					let currentSection = null;

					const lines = keyGenOut.split(/\r?\n/);
					for (const line of lines) {
						const trimmed = line.trim();
						if (trimmed === 'Private: (Keep it secret!)') {
							currentSection = 'private';
							continue;
						} else if (trimmed === 'Public:') {
							currentSection = 'public';
							continue;
						} else if (
							trimmed.startsWith('Environment variables used to sign:')
						) {
							currentSection = null;
							continue;
						}

						if (currentSection === 'private' && trimmed) {
							privateBase64 += trimmed;
						} else if (currentSection === 'public' && trimmed) {
							publicBase64 += trimmed;
						}
					}

					if (privateBase64 && publicBase64) {
						const pubkey = publicBase64;
						const privkey = privateBase64;

						if (pubkey && privkey) {
							// Update tauri.conf.json
							const confPath = path.join(
								targetDir,
								'src-tauri',
								'tauri.conf.json',
							);
							if (fs.existsSync(confPath)) {
								const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'));
								if (conf.plugins?.updater) {
									conf.plugins.updater.pubkey = pubkey;
									fs.writeFileSync(
										confPath,
										JSON.stringify(conf, null, 2),
										'utf8',
									);
									console.log(
										`${colors.green}✅ Updated Tauri public key in tauri.conf.json.${colors.reset}`,
									);
								}
							}
							// Upload Secret
							console.log(`Uploading TAURI_SIGNING_PRIVATE_KEY secret...`);
							execSync('gh secret set TAURI_SIGNING_PRIVATE_KEY', {
								input: privkey,
								cwd: targetDir,
							});
							console.log(
								`${colors.green}✅ TAURI_SIGNING_PRIVATE_KEY secret set.${colors.reset}`,
							);

							if (keyPassword) {
								console.log(
									`Uploading TAURI_SIGNING_PRIVATE_KEY_PASSWORD secret...`,
								);
								execSync('gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD', {
									input: keyPassword,
									cwd: targetDir,
								});
								console.log(
									`${colors.green}✅ TAURI_SIGNING_PRIVATE_KEY_PASSWORD secret set.${colors.reset}`,
								);
							}
						} else {
							throw new Error('Could not parse pubkey or privkey from output');
						}
					} else {
						throw new Error(
							'Key generation output format did not match expected patterns',
						);
					}
				} catch (err) {
					console.error(
						`\n${colors.red}❌ Error: Failed to configure Tauri signing keys: ${err.message}${colors.reset}`,
					);
					const answer = await askQuestion(
						`Do you want to skip Tauri signing key configuration and proceed? (y/N) [default: n]: `,
					);
					if (answer.trim().toLowerCase() !== 'y') {
						throw new Error(
							`Failed to configure Tauri signing keys: ${err.message}`,
						);
					}
					console.log(
						`${colors.yellow}⚠️ Skipping Tauri signing keys configuration.${colors.reset}`,
					);
				}

				// Configure PostHog Analytics
				console.log(
					`\n${colors.cyan}🔑 Configuring PostHog Telemetry...${colors.reset}`,
				);
				const setupPostHogInput = await askQuestion(
					`Do you want to set up PostHog telemetry? (y/N) [default: n]: `,
				);
				if (setupPostHogInput.trim().toLowerCase() === 'y') {
					console.log(
						`\nGet your PostHog API Key from: https://app.posthog.com (Settings → Project API Key)`,
					);
					let posthogKey = '';
					let posthogConfirmed = false;
					while (!posthogConfirmed) {
						posthogKey = await askQuestion(
							`\n${colors.bright}Paste your PostHog API Key here: ${colors.reset}`,
						);
						posthogKey = posthogKey.trim();
						if (!posthogKey) {
							console.error(
								`${colors.red}❌ API key cannot be empty.${colors.reset}`,
							);
							continue;
						}
						const maskedKey =
							posthogKey.length > 8
								? `${posthogKey.substring(0, 4)}...${posthogKey.substring(posthogKey.length - 4)}`
								: '***';
						console.log(`\nAPI Key: ${colors.cyan}${maskedKey}${colors.reset}`);
						const confirmAns = await askQuestion(
							`${colors.bright}Is this correct? (Y/n) [default: y]: ${colors.reset}`,
						);
						if (confirmAns.trim().toLowerCase() !== 'n') {
							posthogConfirmed = true;
						}
					}
					try {
						console.log(`Uploading POSTHOG_API_KEY secret...`);
						execSync('gh secret set POSTHOG_API_KEY', {
							input: posthogKey,
							cwd: targetDir,
						});
						console.log(
							`${colors.green}✅ POSTHOG_API_KEY secret set.${colors.reset}`,
						);
					} catch (err) {
						console.error(
							`\n${colors.red}❌ Error: Failed to set POSTHOG_API_KEY secret: ${err.message}${colors.reset}`,
						);
						const answer = await askQuestion(
							`Do you want to skip PostHog configuration and proceed? (y/N) [default: n]: `,
						);
						if (answer.trim().toLowerCase() !== 'y') {
							throw err;
						}
					}
				} else {
					console.log(
						`${colors.yellow}⚠️ Skipping PostHog configuration (telemetry will be disabled).${colors.reset}`,
					);
				}

				// Generate GPG Key for Debian & RPM Signing
				console.log(
					`\n${colors.cyan}🔑 Generating GPG Key for package signing...${colors.reset}`,
				);
				const gpgHome = path.join(targetDir, '.gpg-temp');
				const gpgConfPath = path.join(targetDir, 'gpg-gen.conf');
				const gpgConf = `Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: ${casings.title}
Expire-Date: 0
%no-ask-passphrase
%no-protection
%commit
`;
				try {
					fs.mkdirSync(gpgHome, { recursive: true });
					fs.chmodSync(gpgHome, 0o700);
					fs.writeFileSync(gpgConfPath, gpgConf, 'utf8');

					const gpgEnv = { ...process.env, GNUPGHOME: gpgHome };

					execSync('gpg --batch --generate-key gpg-gen.conf', {
						cwd: targetDir,
						stdio: 'ignore',
						env: gpgEnv,
					});
					const gpgKey = execSync(
						`gpg --armor --export-secret-keys "${casings.title}"`,
						{ encoding: 'utf8', cwd: targetDir, env: gpgEnv },
					).trim();

					if (gpgKey) {
						console.log(`Uploading GPG_PRIVATE_KEY secret...`);
						execSync('gh secret set GPG_PRIVATE_KEY', {
							input: gpgKey,
							cwd: targetDir,
						});
						console.log(
							`${colors.green}✅ GPG_PRIVATE_KEY secret set.${colors.reset}`,
						);
					}
				} catch (err) {
					console.error(
						`\n${colors.red}❌ Error: Failed to configure GPG keys: ${err.message}${colors.reset}`,
					);
					const answer = await askQuestion(
						`Do you want to skip GPG key configuration and proceed? (y/N) [default: n]: `,
					);
					if (answer.trim().toLowerCase() !== 'y') {
						throw new Error(`Failed to configure GPG keys: ${err.message}`);
					}
					console.log(
						`${colors.yellow}⚠️ Skipping GPG key configuration.${colors.reset}`,
					);
				} finally {
					if (fs.existsSync(gpgConfPath)) {
						fs.unlinkSync(gpgConfPath);
					}
					if (fs.existsSync(gpgHome)) {
						try {
							fs.rmSync(gpgHome, { recursive: true, force: true });
						} catch {
							if (process.platform !== 'win32') {
								try {
									execSync(`rm -rf "${gpgHome}"`);
								} catch {}
							}
						}
					}
				}

				// Create Fedora COPR Repository and Package
				if (isLinux && !skipCopr) {
					console.log(
						`\n${colors.cyan}🐧 Configuring Fedora COPR...${colors.reset}`,
					);
					try {
						let fedoraVer = '';
						try {
							const res = await fetch(
								'https://fedoraproject.org/releases.json',
							);
							if (res.ok) {
								const data = await res.json();
								const versions = data
									.map((r) => parseInt(r.version, 10))
									.filter((v) => !Number.isNaN(v));
								if (versions.length > 0) {
									fedoraVer = String(Math.max(...versions));
								}
							}
						} catch {
							// If network fails, copr-cli will handle the empty string error naturally
						}

						let coprExists = false;
						try {
							execSync(`copr-cli get ${coprUsername}/${casings.kebab}`, {
								stdio: 'ignore',
							});
							coprExists = true;
						} catch {
							// Project does not exist
						}

						if (coprExists) {
							console.log(
								`\n${colors.yellow}⚠️ Fedora COPR repository ${coprUsername}/${casings.kebab} already exists.${colors.reset}`,
							);
							const answer = await askQuestion(
								`Choose action:\n  1. Delete the repo and recreate it from scratch\n  2. Cancel setup\nEnter choice (1/2) [default: 2]: `,
							);
							if (answer.trim() === '1') {
								console.log(
									`Deleting Fedora COPR repository ${casings.kebab}...`,
								);
								const delRes = runCommand(
									`copr-cli delete ${casings.kebab}`,
									targetDir,
								);
								if (!delRes.success) {
									console.warn(
										`${colors.yellow}⚠️ Warning: Failed to delete Fedora COPR repository: ${delRes.stderr || delRes.stdout}${colors.reset}`,
									);
								}
								console.log(
									`Creating COPR project: ${casings.kebab} for Fedora ${fedoraVer}...`,
								);
								const createRes = runCommand(
									`copr-cli create ${casings.kebab} --chroot fedora-${fedoraVer}-x86_64 --chroot fedora-${fedoraVer}-aarch64 --chroot fedora-rawhide-x86_64`,
									targetDir,
								);
								if (!createRes.success) {
									throw new Error(
										createRes.stderr ||
											createRes.stdout ||
											'Failed to create COPR project',
									);
								}
								coprRepoCreated = casings.kebab;
								console.log(
									`${colors.green}✅ Fedora COPR repository recreated.${colors.reset}`,
								);
							} else {
								throw new Error(
									`User aborted setup: Fedora COPR repository already exists.`,
								);
							}
						} else {
							console.log(
								`Creating COPR project: ${casings.kebab} for Fedora ${fedoraVer}...`,
							);
							const createRes = runCommand(
								`copr-cli create ${casings.kebab} --chroot fedora-${fedoraVer}-x86_64 --chroot fedora-${fedoraVer}-aarch64 --chroot fedora-rawhide-x86_64`,
								targetDir,
							);
							if (!createRes.success) {
								throw new Error(
									createRes.stderr ||
										createRes.stdout ||
										'Failed to create COPR project',
								);
							}
							coprRepoCreated = casings.kebab;
							console.log(
								`${colors.green}✅ Fedora COPR repository created.${colors.reset}`,
							);
						}

						console.log(`Adding Git SCM package...`);
						const scmRes = runCommand(
							`copr-cli add-package-scm ${casings.kebab} --name ${casings.kebab} --clone-url "https://github.com/${owner}/${repoName}.git" --spec "src-tauri/resources/${casings.kebab}.spec"`,
							targetDir,
						);
						if (!scmRes.success) {
							throw new Error(
								scmRes.stderr ||
									scmRes.stdout ||
									'Failed to add Git SCM package to COPR',
							);
						}

						console.log(`\n${colors.bright}👉 Action Required:${colors.reset}`);
						console.log(
							`Please open: https://copr.fedorainfracloud.org/coprs/${coprUsername}/${casings.kebab}/integrations/`,
						);
						console.log(`Copy the Custom Webhook URL.`);

						let webhookUrl = '';
						let confirmed = false;
						while (!confirmed) {
							webhookUrl = await askQuestion(
								`\n${colors.bright}Paste the Custom Webhook URL here (or press Enter to skip): ${colors.reset}`,
							);
							webhookUrl = webhookUrl.trim();
							if (!webhookUrl) {
								confirmed = true;
								break;
							}

							// Replace <PACKAGE_NAME> placeholder if present (case-insensitive)
							webhookUrl = webhookUrl.replace(/<package_name>/i, casings.kebab);

							console.log(
								`\nWebhook URL: ${colors.cyan}${webhookUrl}${colors.reset}`,
							);
							const confirmAns = await askQuestion(
								`${colors.bright}Is this correct? (Y/n) [default: y]: ${colors.reset}`,
							);
							if (confirmAns.trim().toLowerCase() !== 'n') {
								confirmed = true;
							}
						}

						if (webhookUrl) {
							execSync('gh secret set COPR_WEBHOOK_URL', {
								input: webhookUrl,
								cwd: targetDir,
							});
							console.log(
								`${colors.green}✅ COPR_WEBHOOK_URL secret set.${colors.reset}`,
							);
						}
					} catch (err) {
						console.error(
							`\n${colors.red}❌ Error: Failed to configure Fedora COPR: ${err.message}${colors.reset}`,
						);
						const answer = await askQuestion(
							`Do you want to skip Fedora COPR configuration and proceed with the rest of setup? (y/N) [default: n]: `,
						);
						if (answer.trim().toLowerCase() !== 'y') {
							throw err;
						}
						console.log(
							`${colors.yellow}⚠️ Skipping Fedora COPR configuration.${colors.reset}`,
						);
					}
				}
			}
		}
	}

	// --- 7. INSTALL DEPENDENCIES ---
	console.log(
		`\n${colors.cyan}📦 Installing dependencies & bootstrapping (this may take a minute)...${colors.reset}`,
	);
	await runCommandOrThrow(
		'pnpm install',
		targetDir,
		'Failed to install dependencies',
	);
	await runCommandOrThrow(
		'pnpm bootstrap',
		targetDir,
		'Failed to bootstrap project',
	);
	console.log(`${colors.green}✅ Dependencies installed.${colors.reset}`);

	// Remove gh and copr-cli from knip.json ignoreBinaries
	const knipPath = path.join(targetDir, 'knip.json');
	if (fs.existsSync(knipPath)) {
		try {
			const knip = JSON.parse(fs.readFileSync(knipPath, 'utf8'));
			if (Array.isArray(knip.ignoreBinaries)) {
				knip.ignoreBinaries = knip.ignoreBinaries.filter(
					(bin) => bin !== 'gh' && bin !== 'copr-cli',
				);
				fs.writeFileSync(
					knipPath,
					`${JSON.stringify(knip, null, '\t')}\n`,
					'utf8',
				);
				console.log(
					`${colors.green}✅ Removed gh and copr-cli from knip.json ignoreBinaries.${colors.reset}`,
				);
			}
		} catch (err) {
			console.warn(
				`${colors.yellow}⚠️ Warning: Failed to update knip.json: ${err.message}${colors.reset}`,
			);
		}
	}

	// --- 8. INITIAL COMMIT & GITHUB SETUP ---
	console.log(`\n${colors.cyan}🔧 Creating initial commit...${colors.reset}`);
	await runCommandOrThrow(
		'pnpm exec biome check --write',
		targetDir,
		'Failed to run Biome checks',
	);
	await runCommandOrThrow(
		'cargo generate-lockfile',
		path.join(targetDir, 'src-tauri'),
		'Failed to generate Cargo lockfile',
	);
	await runCommandOrThrow(
		'git add .',
		targetDir,
		'Failed to stage files in git',
	);
	await runCommandOrThrow(
		'git commit -m "feat: initial commit [skip ci]"',
		targetDir,
		'Failed to create initial commit',
	);
	await runCommandOrThrow(
		'git branch main',
		targetDir,
		'Failed to create main branch',
	);
	await runCommandOrThrow(
		'git tag v0.0.9',
		targetDir,
		'Failed to create tag v0.0.9',
	);
	console.log(
		`${colors.green}✅ Git repository committed on dev and main branch created.${colors.reset}`,
	);

	if (setupCi) {
		console.log(
			`\n${colors.cyan}🚀 Pushing initial commit to GitHub...${colors.reset}`,
		);
		try {
			await runCommandOrThrow(
				'git push -u origin dev',
				targetDir,
				'Failed to push dev branch to GitHub',
			);
			console.log(
				`${colors.green}✅ Pushed dev branch to GitHub.${colors.reset}`,
			);

			console.log(
				`\n${colors.cyan}🔧 Setting default branch and repo options on GitHub...${colors.reset}`,
			);
			execSync(`gh api -X PATCH repos/${owner}/${repoName} --input -`, {
				input: JSON.stringify({
					default_branch: 'dev',
					homepage: `https://${owner.toLowerCase()}.github.io/${repoName}/`,
					has_wiki: false,
					has_projects: false,
					allow_rebase_merge: false,
					allow_auto_merge: true,
				}),
				cwd: targetDir,
				stdio: ['pipe', 'ignore', 'pipe'],
			});
			console.log(
				`${colors.green}✅ Default branch set to dev, homepage set, wikis/projects disabled, rebase disabled, auto-merge allowed.${colors.reset}`,
			);

			console.log(
				`\n${colors.cyan}🚀 Pushing main branch to GitHub...${colors.reset}`,
			);
			await runCommandOrThrow(
				'git push -u origin main',
				targetDir,
				'Failed to push main branch to GitHub',
			);
			console.log(
				`${colors.green}✅ Pushed main branch to GitHub.${colors.reset}`,
			);

			console.log(
				`\n${colors.cyan}🚀 Pushing tag v0.0.9 to GitHub...${colors.reset}`,
			);
			await runCommandOrThrow(
				'git push origin v0.0.9',
				targetDir,
				'Failed to push tag v0.0.9 to GitHub',
			);
			console.log(
				`${colors.green}✅ Pushed tag v0.0.9 to GitHub.${colors.reset}`,
			);

			console.log(
				`\n${colors.cyan}🔒 Configuring GitHub branch rulesets...${colors.reset}`,
			);
			const devFlowRuleset = {
				name: 'dev flow',
				target: 'branch',
				enforcement: 'active',
				conditions: {
					ref_name: {
						exclude: [],
						include: ['refs/heads/dev'],
					},
				},
				rules: [
					{
						type: 'deletion',
					},
					{
						type: 'non_fast_forward',
					},
					{
						type: 'required_status_checks',
						parameters: {
							strict_required_status_checks_policy: true,
							do_not_enforce_on_create: false,
							required_status_checks: [
								{
									context: 'Lint & Test',
									integration_id: 15368,
								},
								{
									context: 'Validate PR title',
									integration_id: 15368,
								},
							],
						},
					},
					{
						type: 'pull_request',
						parameters: {
							required_approving_review_count: 0,
							dismiss_stale_reviews_on_push: false,
							required_reviewers: [],
							require_code_owner_review: false,
							require_last_push_approval: false,
							required_review_thread_resolution: false,
							allowed_merge_methods: ['squash'],
						},
					},
				],
				bypass_actors: [
					{
						actor_id: 5,
						actor_type: 'RepositoryRole',
						bypass_mode: 'always',
					},
				],
			};

			const mainFlowRuleset = {
				name: 'main flow',
				target: 'branch',
				enforcement: 'active',
				conditions: {
					ref_name: {
						exclude: [],
						include: ['refs/heads/main'],
					},
				},
				rules: [
					{
						type: 'deletion',
					},
					{
						type: 'non_fast_forward',
					},
					{
						type: 'required_status_checks',
						parameters: {
							strict_required_status_checks_policy: true,
							do_not_enforce_on_create: false,
							required_status_checks: [
								{
									context: 'build / Test Fedora RPM (amd64)',
									integration_id: 15368,
								},
								{
									context: 'build / Test Fedora RPM (arm64)',
									integration_id: 15368,
								},
								{
									context: 'build / Test Ubuntu Artifacts (amd64)',
									integration_id: 15368,
								},
								{
									context: 'build / Test Ubuntu Artifacts (arm64)',
									integration_id: 15368,
								},
								{
									context: 'build / Test Windows Artifacts (arm64)',
									integration_id: 15368,
								},
								{
									context: 'build / Test Windows Artifacts (x64)',
									integration_id: 15368,
								},
								{
									context: 'Validate PR title',
									integration_id: 15368,
								},
							],
						},
					},
					{
						type: 'code_scanning',
						parameters: {
							code_scanning_tools: [
								{
									tool: 'CodeQL',
									security_alerts_threshold: 'high_or_higher',
									alerts_threshold: 'errors',
								},
							],
						},
					},
					{
						type: 'pull_request',
						parameters: {
							required_approving_review_count: 0,
							dismiss_stale_reviews_on_push: false,
							required_reviewers: [],
							require_code_owner_review: false,
							require_last_push_approval: false,
							required_review_thread_resolution: false,
							allowed_merge_methods: ['merge'],
						},
					},
				],
				bypass_actors: [
					{
						actor_id: 5,
						actor_type: 'RepositoryRole',
						bypass_mode: 'always',
					},
				],
			};

			execSync(`gh api -X POST repos/${owner}/${repoName}/rulesets --input -`, {
				input: JSON.stringify(devFlowRuleset),
				cwd: targetDir,
				stdio: ['pipe', 'ignore', 'pipe'],
			});
			execSync(`gh api -X POST repos/${owner}/${repoName}/rulesets --input -`, {
				input: JSON.stringify(mainFlowRuleset),
				cwd: targetDir,
				stdio: ['pipe', 'ignore', 'pipe'],
			});
			console.log(
				`${colors.green}✅ Branch rulesets configured successfully.${colors.reset}`,
			);
		} catch (err) {
			console.warn(
				`\n${colors.yellow}⚠️ Warning: Failed to complete GitHub repository push, settings, or ruleset setup: ${err.message}${colors.reset}`,
			);
			const answer = await askQuestion(
				`Do you want to ignore this and proceed with the setup? (y/N) [default: n]: `,
			);
			if (answer.trim().toLowerCase() !== 'y') {
				throw new Error(
					`GitHub push/ruleset/pages configuration failed: ${err.message}`,
				);
			}
		}
	}

	console.log(
		`\n${colors.green}${colors.bright}🎉 Project successfully initialized!${colors.reset}\n`,
	);

	rl.close();

	console.log(`${colors.bright}To get started, run:${colors.reset}`);
	console.log(`  cd ${targetDir} && pnpm tauri:dev\n`);
}

main().catch((err) => {
	console.error(`\n${colors.red}Fatal Error: ${err.message}${colors.reset}`);
	if (ghRepoCreated) {
		console.log(
			`\n${colors.yellow}🧹 Rolling back: Deleting GitHub repository ${ghRepoCreated}...${colors.reset}`,
		);
		try {
			execSync(`gh repo delete ${ghRepoCreated} --yes`, { stdio: 'ignore' });
			console.log(
				`${colors.green}✅ GitHub repository deleted.${colors.reset}`,
			);
		} catch (cleanupErr) {
			console.error(
				`${colors.red}❌ Failed to delete GitHub repository: ${cleanupErr.message}${colors.reset}`,
			);
		}
	}

	if (coprRepoCreated) {
		console.log(
			`\n${colors.yellow}🧹 Rolling back: Deleting Fedora COPR repository ${coprRepoCreated}...${colors.reset}`,
		);
		try {
			execSync(`copr-cli delete ${coprRepoCreated}`, { stdio: 'ignore' });
			console.log(
				`${colors.green}✅ Fedora COPR repository deleted.${colors.reset}`,
			);
		} catch (cleanupErr) {
			console.error(
				`${colors.red}❌ Failed to delete Fedora COPR repository: ${cleanupErr.message}${colors.reset}`,
			);
		}
	}

	if (targetDirCreated && fs.existsSync(targetDirCreated)) {
		console.log(
			`\n${colors.yellow}🧹 Rolling back: Deleting target directory ${targetDirCreated}...${colors.reset}`,
		);
		try {
			try {
				fs.rmSync(targetDirCreated, { recursive: true, force: true });
			} catch (rmErr) {
				if (process.platform !== 'win32') {
					execSync(`rm -rf "${targetDirCreated}"`);
				} else {
					throw rmErr;
				}
			}
			console.log(`${colors.green}✅ Rollback complete.${colors.reset}`);
		} catch (cleanupErr) {
			console.error(
				`${colors.red}❌ Failed to delete target directory: ${cleanupErr.message}${colors.reset}`,
			);
		}
	}
	rl.close();
	process.exit(1);
});
