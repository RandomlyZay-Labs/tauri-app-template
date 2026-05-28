import { mockIPC } from '@tauri-apps/api/mocks';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as systemUtils from '@/lib/system-utils';
import { networkStore } from '@/stores/networkStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import { updateStore } from '@/stores/updateStore.svelte';
import UpdateSettings from './UpdateSettings.svelte';

vi.unmock('@tauri-apps/plugin-clipboard-manager');

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string, _params?: unknown) => key),
}));

// Mock toast
vi.mock('@/lib/toast', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe('UpdateSettings', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Reset store states
		networkStore.isOffline = false;
		updateStore.status = 'idle';
		updateStore.version = '';
		updateStore.date = undefined;
		updateStore.body = undefined;
		updateStore.error = null;
		updateStore.activeUpdate = null;
		updateStore.installType = 'nsis'; // Default to bundled
		updateStore.installTypeInitialized = true;
		updateStore.cliUpdateStatus = 'idle';

		mockIPC((cmd) => {
			if (cmd === 'get_install_type') return 'nsis';
			if (cmd === 'get_cli_status')
				return { installed: true, version: '1.0.0' };
			if (cmd === 'install_cli') return null;
		});

		// Mock global fetch for GitHub changelog API
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						body: 'Release notes with a [GitHub Link](https://github.com)',
					}),
			}),
		);
	});

	afterEach(async () => {
		cleanup();
	});

	it('renders update settings controls', { timeout: 10000 }, () => {
		render(UpdateSettings);

		expect(screen.getByText('updateSettings.title')).toBeTruthy();
		expect(screen.getByText('updateSettings.autoCheck')).toBeTruthy();
		expect(screen.getByText('updateSettings.checkUpdates')).toBeTruthy();
		expect(screen.getByText('updateSettings.cliSection')).toBeTruthy();
	});

	it('toggles autoCheckUpdates when its switch is clicked', {
		timeout: 10000,
	}, async () => {
		render(UpdateSettings);

		const initialValue = uiStore.autoCheckUpdates;
		const switches = screen.getAllByRole('switch');
		const autoCheckSwitch = switches.find((s) => s.id === 'auto-check-switch');
		expect(autoCheckSwitch).toBeDefined();

		if (autoCheckSwitch) {
			await fireEvent.click(autoCheckSwitch);
		}

		expect(uiStore.autoCheckUpdates).toBe(!initialValue);
	});

	it('resets autoCheckUpdates when reset button is clicked', {
		timeout: 10000,
	}, async () => {
		uiStore.autoCheckUpdates = false;
		render(UpdateSettings);

		const resetBtn = screen.getByRole('button', {
			name: 'updateSettings.resetAutoCheck',
		});
		await fireEvent.click(resetBtn);

		expect(uiStore.autoCheckUpdates).toBe(true);
	});

	it('triggers manual update check when button is clicked', {
		timeout: 10000,
	}, async () => {
		const spy = vi
			.spyOn(updateStore, 'checkForUpdates')
			.mockResolvedValue(undefined);
		render(UpdateSettings);

		const btn = screen.getByText('updateSettings.checkUpdates');
		await fireEvent.click(btn);

		expect(spy).toHaveBeenCalledWith(true);
	});

	it('renders update available container and triggers download', {
		timeout: 10000,
	}, async () => {
		updateStore.status = 'available';
		updateStore.version = '2.0.0';
		updateStore.date = '2026-05-21';
		updateStore.activeUpdate = {} as unknown as Update;

		const spy = vi
			.spyOn(updateStore, 'downloadAndInstallUpdate')
			.mockResolvedValue(undefined);

		render(UpdateSettings);

		expect(
			screen.getByText('updateSettings.updateAvailableTitle'),
		).toBeTruthy();
		expect(screen.getByText('updateSettings.releasedOn')).toBeTruthy();

		// Changelog is fetched asynchronously from the GitHub API
		await vi.waitFor(() => {
			expect(screen.getByText(/Release notes/)).toBeTruthy();
		});

		const downloadBtn = screen.getByText('updateSettings.downloadAndInstall');
		await fireEvent.click(downloadBtn);

		expect(spy).toHaveBeenCalled();
	});

	it('renders downloaded relaunch button and triggers applyUpdate', {
		timeout: 10000,
	}, async () => {
		updateStore.status = 'downloaded';
		updateStore.activeUpdate = {} as unknown as Update;

		const spy = vi
			.spyOn(updateStore, 'applyUpdate')
			.mockResolvedValue(undefined);

		render(UpdateSettings);

		const relaunchBtn = screen.getByRole('button', {
			name: 'updateSettings.relaunchToApply',
		});
		await fireEvent.click(relaunchBtn);

		expect(spy).toHaveBeenCalled();
	});

	it('renders offline status and disables update check button when offline', {
		timeout: 10000,
	}, async () => {
		networkStore.isOffline = true;
		render(UpdateSettings);

		expect(screen.getByText('updateSettings.statusOffline')).toBeTruthy();

		const checkBtn = screen.getByRole('button', {
			name: 'updateSettings.checkUpdates',
		});
		expect(checkBtn.hasAttribute('disabled')).toBe(true);
	});

	it('renders check failure error card and hides Update Available container when check fails', {
		timeout: 10000,
	}, async () => {
		updateStore.status = 'error';
		updateStore.error = 'Could not fetch a valid release JSON from the remote';
		updateStore.activeUpdate = null;

		render(UpdateSettings);

		// The detailed update available container should NOT render
		expect(
			screen.queryByText('updateSettings.updateAvailableTitle'),
		).toBeNull();

		// Instead, the check error card should be displayed
		expect(screen.getByText('updateSettings.checkFailed')).toBeTruthy();
		expect(
			screen.getByText('Could not fetch a valid release JSON from the remote'),
		).toBeTruthy();
	});

	it('exercises the package-manager branch for deb installs', {
		timeout: 10000,
	}, async () => {
		let capturedText: string | null = null;
		mockIPC((cmd, args) => {
			if (cmd === 'plugin:clipboard-manager|write_text') {
				capturedText = (args as { text: string }).text;
				return null;
			}
		});

		updateStore.status = 'available';
		updateStore.version = '2.0.0';
		updateStore.installType = 'deb';
		updateStore.installTypeInitialized = true;
		updateStore.activeUpdate = {} as unknown as Update;

		render(UpdateSettings);

		// Assert package manager notice text appears
		expect(screen.getByText('updateSettings.packageManagedTitle')).toBeTruthy();
		expect(screen.getByText('updateSettings.packageManagedDesc')).toBeTruthy();

		// Relaunch or download actions should not be shown
		expect(screen.queryByText('updateSettings.relaunchToApply')).toBeNull();
		expect(screen.queryByText('updateSettings.downloadAndInstall')).toBeNull();

		// Copy command works
		const copyBtn = screen.getByText('updateSettings.copyCommand');
		await fireEvent.click(copyBtn);
		expect(capturedText).toBe('updateSettings.debCommand');
	});

	it('exercises the package-manager branch for rpm installs', {
		timeout: 10000,
	}, async () => {
		let capturedText: string | null = null;
		mockIPC((cmd, args) => {
			if (cmd === 'plugin:clipboard-manager|write_text') {
				capturedText = (args as { text: string }).text;
				return null;
			}
		});

		updateStore.status = 'available';
		updateStore.version = '2.0.0';
		updateStore.installType = 'rpm';
		updateStore.installTypeInitialized = true;
		updateStore.activeUpdate = {} as unknown as Update;

		render(UpdateSettings);

		// Assert package manager notice text appears
		expect(screen.getByText('updateSettings.packageManagedTitle')).toBeTruthy();
		expect(screen.getByText('updateSettings.packageManagedDesc')).toBeTruthy();

		// Relaunch or download actions should not be shown
		expect(screen.queryByText('updateSettings.relaunchToApply')).toBeNull();
		expect(screen.queryByText('updateSettings.downloadAndInstall')).toBeNull();

		// Copy command works
		const copyBtn = screen.getByText('updateSettings.copyCommand');
		await fireEvent.click(copyBtn);
		expect(capturedText).toBe('updateSettings.rpmCommand');
	});

	it('exercises CLI integration UI conditional rendering - bundled', async () => {
		updateStore.installType = 'nsis';
		updateStore.installTypeInitialized = true;

		render(UpdateSettings);

		await vi.waitFor(() => {
			expect(screen.getByText('updateSettings.cliManagedByApp')).toBeTruthy();
		});
		expect(screen.queryByText('cliSettings.updateCli')).toBeNull();
	});

	it('exercises CLI integration UI conditional rendering - package managed', async () => {
		updateStore.installType = 'deb';
		updateStore.installTypeInitialized = true;

		mockIPC((cmd) => {
			if (cmd === 'get_cli_status')
				return { installed: true, version: '1.0.0' };
		});

		render(UpdateSettings);

		await vi.waitFor(() => {
			expect(screen.queryByText('updateSettings.cliManagedByApp')).toBeNull();
		});
	});

	it('intercepts markdown link clicks and opens them in default browser', async () => {
		updateStore.status = 'available';
		updateStore.version = '2.0.0';
		updateStore.date = '2026-05-21';
		updateStore.activeUpdate = {} as unknown as Update;

		const spy = vi
			.spyOn(systemUtils, 'openExternalLink')
			.mockResolvedValue(undefined);

		render(UpdateSettings);

		// Wait for changelog with link to render
		let link: HTMLAnchorElement | null = null;
		await vi.waitFor(() => {
			link = screen.getByText('GitHub Link') as HTMLAnchorElement;
			expect(link).toBeTruthy();
		});

		if (!link) {
			throw new Error('Link element not found');
		}

		// Trigger click event on the link
		await fireEvent.click(link);

		// Verify openExternalLink was called
		expect(spy).toHaveBeenCalledWith('https://github.com');
	});
});
