import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Helper to run a command and return stdout
function runGitCommand(cmd) {
	try {
		return execSync(cmd, {
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();
	} catch (err) {
		const stderr = err.stderr ? err.stderr.toString().trim() : '';
		if (stderr) {
			console.warn(`Git command failed: ${cmd}\nError details: ${stderr}`);
		}
		return '';
	}
}

// 1. Collect changed files
let changedFilesList = [];

if (process.env.GITHUB_ACTIONS === 'true') {
	console.log('Running in GitHub Actions. Detecting changed files via Git...');
	try {
		// Try comparing against first parent (handles merge commits in PRs)
		let diffOutput = runGitCommand(
			'git diff-tree --no-commit-id --name-only -r HEAD^1 HEAD',
		);
		// Fallback to single commit diff if parent comparison fails
		if (!diffOutput) {
			diffOutput = runGitCommand(
				'git diff-tree --no-commit-id --name-only -r HEAD',
			);
		}
		changedFilesList = diffOutput.split('\n').filter(Boolean);
		console.log(
			`GitHub Actions change detection found ${changedFilesList.length} files.`,
		);
	} catch (err) {
		console.warn(
			'Failed to detect files via git diff-tree in GHA:',
			err.message,
		);
	}
}

// Fallback to local workspace diff if not in GHA or if GHA detection returned no files
if (changedFilesList.length === 0) {
	const unstaged = runGitCommand('git diff --name-only')
		.split('\n')
		.filter(Boolean);
	const staged = runGitCommand('git diff --cached --name-only')
		.split('\n')
		.filter(Boolean);
	const untracked = runGitCommand('git ls-files --others --exclude-standard')
		.split('\n')
		.filter(Boolean);
	changedFilesList = Array.from(
		new Set([...unstaged, ...staged, ...untracked]),
	);
}

// Unique list of all modified or new files, ignoring the scripts directory
const changedFiles = changedFilesList
	.map((f) => f.trim())
	.filter(Boolean)
	.filter((f) => !f.startsWith('scripts/'));

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
	console.log(`Detected ${changedFiles.length} changed files.`);
} else {
	console.log('No changed files detected in the working tree.');
}

// 3. Check if the AI was dumb (no Rust or TS/Svelte/frontend changes)
if (!hasRustChanges && !hasTsChanges) {
	if (process.env.GITHUB_ACTIONS === 'true') {
		console.log(
			'No code changes (Rust or Frontend) detected in CI. Skipping verification steps.',
		);
		process.exit(0);
	}
	console.error(`
🚨 DUMB AI DETECTED! 🚨

You invoked 'pnpm verify', but NEITHER Rust (.rs) nor TypeScript/Svelte (.ts, .svelte)
files were edited in this workspace!

Please do NOT run verification if you are only modifying documentation (.md),
workflows (.yaml), or if you haven't made any edits at all.
`);
	process.exit(1);
}

// 4. Implement decision tree based on changes
if (hasRustChanges && !hasTsChanges) {
	console.log(
		'Only Rust files were edited. Checking if bindings.ts changes...',
	);

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

	if (!bindingsChanged) {
		console.log('bindings.ts is unchanged. Running pnpm verify:backend...');
		try {
			execSync('pnpm verify:backend', { stdio: 'inherit' });
		} catch {
			process.exit(1);
		}
	} else {
		console.log('bindings.ts changed! Running the full verification suite...');
		try {
			execSync('pnpm verify:backend && pnpm verify:frontend', {
				stdio: 'inherit',
			});
		} catch {
			process.exit(1);
		}
	}
} else if (hasRustChanges && hasTsChanges) {
	console.log(
		'Both Rust and frontend files were edited. Running the full verification suite...',
	);
	try {
		execSync('pnpm verify:backend && pnpm verify:frontend', {
			stdio: 'inherit',
		});
	} catch {
		process.exit(1);
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
