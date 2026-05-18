import { mockIPC } from '@tauri-apps/api/mocks';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CliSettings from './CliSettings.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string, _params?: unknown) => key),
}));

// Mock app-version
vi.mock('@/lib/app-version.svelte', () => ({
	getAppVersion: vi.fn(() => '0.1.0'),
}));

// Mock toast
vi.mock('@/lib/toast', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe('CliSettings', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it('renders not installed state', async () => {
		mockIPC((cmd) => {
			if (cmd === 'get_cli_status') return { installed: false, version: null };
			return null;
		});

		render(CliSettings);
		await tick();

		expect(await screen.findByText('cliSettings.notInstalled')).toBeTruthy();
		expect(screen.getByText('cliSettings.installCli')).toBeTruthy();
	});

	it('renders up to date state', async () => {
		mockIPC((cmd) => {
			if (cmd === 'get_cli_status')
				return { installed: true, version: '0.1.0' };
			return null;
		});

		render(CliSettings);
		await tick();

		expect(await screen.findByText(/cliSettings.upToDate/)).toBeTruthy();
		expect(screen.getByText('cliSettings.installed')).toBeTruthy();
	});

	it('renders version mismatch state', async () => {
		mockIPC((cmd) => {
			if (cmd === 'get_cli_status')
				return { installed: true, version: '0.0.9' };
			return null;
		});

		render(CliSettings);
		await tick();

		expect(await screen.findByText(/cliSettings.versionMismatch/)).toBeTruthy();
		expect(screen.getByText('cliSettings.updateCli')).toBeTruthy();
	});

	it('triggers installation when install button is clicked', async () => {
		let capturedInstall = false;
		mockIPC((cmd) => {
			if (cmd === 'get_cli_status') return { installed: false, version: null };
			if (cmd === 'install_cli') {
				capturedInstall = true;
				return null;
			}
			return null;
		});

		render(CliSettings);

		const installBtn = await screen.findByRole('button', {
			name: /cliSettings.installCli/,
		});
		// Wait for button to not be disabled (cliStatus loaded)
		await waitFor(() =>
			expect(installBtn.hasAttribute('disabled')).toBe(false),
		);

		await fireEvent.click(installBtn);

		await waitFor(
			() => {
				expect(capturedInstall).toBe(true);
			},
			{ timeout: 2000 },
		);
	});
});
