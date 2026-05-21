import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Helper to run a command and return stdout
function runGitCommand(cmd) {
	try {
		return execSync(cmd, {
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'ignore'],
		}).trim();
	} catch {
		return '';
	}
}

// 1. Collect all edited, staged, and untracked files
const unstaged = runGitCommand('git diff --name-only')
	.split('\n')
	.filter(Boolean);
const staged = runGitCommand('git diff --cached --name-only')
	.split('\n')
	.filter(Boolean);
const untracked = runGitCommand('git ls-files --others --exclude-standard')
	.split('\n')
	.filter(Boolean);

// Unique list of all modified or new files
const changedFiles = Array.from(new Set([...unstaged, ...staged, ...untracked]))
	.map((f) => f.trim())
	.filter(Boolean);

// 2. Classify changed files
const backendConfigs = [
	'Cargo.toml',
	'Cargo.lock',
	'tauri.conf.json',
	'default.json',
];
const frontendConfigs = [
	'package.json',
	'pnpm-lock.yaml',
	'tsconfig.json',
	'tsconfig.app.json',
	'tsconfig.node.json',
	'tsconfig.app.json',
	'svelte.config.js',
	'vite.config.ts',
	'playwright.config.ts',
	'components.json',
	'biome.json',
	'knip.json',
];

const hasRustChanges = changedFiles.some(
	(f) =>
		f.endsWith('.rs') || backendConfigs.some((config) => f.endsWith(config)),
);

// Frontend files are Svelte templates, source code files, or frontend-related configurations
const hasTsChanges = changedFiles.some(
	(f) =>
		f.endsWith('.ts') ||
		f.endsWith('.svelte') ||
		f.endsWith('.js') ||
		f.endsWith('.html') ||
		f.endsWith('.css') ||
		frontendConfigs.some((config) => f.endsWith(config)),
);

if (changedFiles.length > 0) {
	console.log('Detected changed files:');
	changedFiles.forEach((f) => {
		console.log(`  - ${f}`);
	});
} else {
	console.log('No changed files detected in the working tree.');
}

// 3. Check if the AI was dumb (no Rust or TS/Svelte/frontend changes)
if (!hasRustChanges && !hasTsChanges) {
	console.error(`
################################################################################
🚨 DUMB AI DETECTED! 🚨

You invoked 'pnpm verify', but NEITHER Rust (.rs) nor TypeScript/Svelte (.ts, .svelte)
files were edited in this workspace!

Please do NOT run verification if you are only modifying config files (.json, .yaml,
.md, etc.) or if you haven't made any edits at all. Stop wasting CPU cycles!
################################################################################
`);
	process.exit(1);
}

// 4. Implement decision tree based on changes
if (hasRustChanges) {
	console.log('Rust files were edited. Checking if bindings.ts changes...');

	const bindingsPath = path.join(process.cwd(), 'src', 'bindings.ts');
	let initialHash = null;
	if (fs.existsSync(bindingsPath)) {
		initialHash = crypto
			.createHash('sha256')
			.update(fs.readFileSync(bindingsPath))
			.digest('hex');
	}

	// Run gen:bindings
	console.log('Running pnpm gen:bindings...');
	try {
		execSync('pnpm gen:bindings', { stdio: 'inherit' });
	} catch (err) {
		console.error('Error generating bindings:', err.message);
		process.exit(1);
	}

	let finalHash = null;
	if (fs.existsSync(bindingsPath)) {
		finalHash = crypto
			.createHash('sha256')
			.update(fs.readFileSync(bindingsPath))
			.digest('hex');
	}

	const bindingsChanged = initialHash !== finalHash;

	if (!bindingsChanged && !hasTsChanges) {
		console.log(
			'bindings.ts is unchanged and no frontend files were edited. Running pnpm verify:backend...',
		);
		try {
			execSync('pnpm verify:backend', { stdio: 'inherit' });
		} catch {
			process.exit(1);
		}
	} else {
		if (bindingsChanged) {
			console.log(
				'bindings.ts changed! Running the full verification suite...',
			);
		} else {
			console.log(
				'Other frontend files changed! Running the full verification suite...',
			);
		}
		try {
			execSync('pnpm verify:backend && pnpm verify:frontend', {
				stdio: 'inherit',
			});
		} catch {
			process.exit(1);
		}
	}
} else {
	// Only frontend files changed (since hasRustChanges is false, but hasTsChanges is true)
	console.log('Only frontend files changed. Running pnpm verify:frontend...');
	try {
		execSync('pnpm verify:frontend', { stdio: 'inherit' });
	} catch {
		process.exit(1);
	}
}
