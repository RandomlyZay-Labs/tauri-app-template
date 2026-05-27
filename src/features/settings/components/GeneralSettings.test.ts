import { mockIPC } from '@tauri-apps/api/mocks';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { networkStore } from '@/stores/networkStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import { updateStore } from '@/stores/updateStore.svelte';
import GeneralSettings from './GeneralSettings.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string, _params?: unknown) => key),
}));

// Mock telemetry (wraps posthog, not direct IPC)
vi.mock('@/lib/telemetry', () => ({
	updateTelemetryConsent: vi.fn(),
}));

// Mock toast
vi.mock('@/lib/toast', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe('GeneralSettings', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();

		// Reset store states
		networkStore.isOffline = false;
		updateStore.status = 'idle';
		updateStore.version = '';
		updateStore.date = undefined;
		updateStore.body = undefined;
		updateStore.error = null;
		updateStore.activeUpdate = null;
		updateStore.installType = 'unknown';
		updateStore.installTypeInitialized = false;

		mockIPC((cmd) => {
			if (cmd === 'open_log_dir') return null;
			if (cmd === 'open_data_dir') return null;
			if (cmd === 'reset_application') return null;
			if (cmd === 'get_install_type') return 'nsis';
		});
	});

	afterEach(async () => {
		cleanup();
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	it('renders general settings controls', { timeout: 10000 }, () => {
		render(GeneralSettings);

		expect(screen.getByText('generalSettings.storageLogs')).toBeTruthy();
		expect(screen.getByText('generalSettings.telemetry')).toBeTruthy();
	});

	it('opens log directory when button is clicked', {
		timeout: 10000,
	}, async () => {
		let capturedCmd: string | null = null;
		mockIPC((cmd) => {
			if (cmd === 'open_log_dir') {
				capturedCmd = cmd;
				return null;
			}
		});

		render(GeneralSettings);

		const btn = screen.getByText('generalSettings.openLogs');
		await fireEvent.click(btn);

		expect(capturedCmd).toBe('open_log_dir');
	});

	it('opens data directory when button is clicked', {
		timeout: 10000,
	}, async () => {
		let capturedCmd: string | null = null;
		mockIPC((cmd) => {
			if (cmd === 'open_data_dir') {
				capturedCmd = cmd;
				return null;
			}
		});

		render(GeneralSettings);

		const btn = screen.getByText('generalSettings.openData');
		await fireEvent.click(btn);

		expect(capturedCmd).toBe('open_data_dir');
	});

	it('toggles telemetry when switch is clicked', {
		timeout: 10000,
	}, async () => {
		const { updateTelemetryConsent } = await import('@/lib/telemetry');
		render(GeneralSettings);

		const initialValue = uiStore.telemetryEnabled;
		const switches = screen.getAllByRole('switch');
		const telemetrySwitch = switches.find((s) => s.id === 'telemetry-switch');
		expect(telemetrySwitch).toBeDefined();

		if (telemetrySwitch) {
			await fireEvent.click(telemetrySwitch);
		}

		expect(uiStore.telemetryEnabled).toBe(!initialValue);
		expect(updateTelemetryConsent).toHaveBeenCalledWith(!initialValue);
	});

	it('renders update settings controls', { timeout: 10000 }, () => {
		render(GeneralSettings);

		expect(screen.getByText('updateSettings.title')).toBeTruthy();
		expect(screen.getByText('updateSettings.autoCheck')).toBeTruthy();
		expect(screen.getByText('updateSettings.checkUpdates')).toBeTruthy();
	});

	it('toggles autoCheckUpdates when its switch is clicked', {
		timeout: 10000,
	}, async () => {
		render(GeneralSettings);

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
		render(GeneralSettings);

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
		render(GeneralSettings);

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
		updateStore.body = 'Release notes';

		const spy = vi
			.spyOn(updateStore, 'downloadAndInstallUpdate')
			.mockResolvedValue(undefined);

		render(GeneralSettings);

		expect(
			screen.getByText('updateSettings.updateAvailableTitle'),
		).toBeTruthy();
		expect(
			screen.getByText('settings.version: 2.0.0 (2026-05-21)'),
		).toBeTruthy();
		expect(screen.getByText('Release notes')).toBeTruthy();

		const downloadBtn = screen.getByText('updateSettings.downloadAndInstall');
		await fireEvent.click(downloadBtn);

		expect(spy).toHaveBeenCalled();
	});

	it('renders downloaded relaunch button and triggers applyUpdate', {
		timeout: 10000,
	}, async () => {
		updateStore.status = 'downloaded';

		const spy = vi
			.spyOn(updateStore, 'applyUpdate')
			.mockResolvedValue(undefined);

		render(GeneralSettings);

		const relaunchBtn = screen.getByRole('button', {
			name: 'updateSettings.relaunchToApply',
		});
		await fireEvent.click(relaunchBtn);

		expect(spy).toHaveBeenCalled();
	});

	it('opens preference reset dialog and resets preferences', {
		timeout: 10000,
	}, async () => {
		render(GeneralSettings);

		const resetBtn = screen.getByText('generalSettings.resetDefaults');
		await fireEvent.click(resetBtn);

		expect(
			screen.getByText('generalSettings.resetPreferencesTitle'),
		).toBeTruthy();

		const confirmBtn = screen.getByText('generalSettings.confirmReset');
		await fireEvent.click(confirmBtn);

		expect(uiStore.sidebarOpen).toBe(true);
		expect(uiStore.telemetryEnabled).toBe(false);

		await tick();
		vi.runAllTimers();
	});

	it('opens application reset dialog and requires confirmation phrase', {
		timeout: 10000,
	}, async () => {
		let capturedCmd: string | null = null;
		mockIPC((cmd) => {
			if (cmd === 'reset_application') {
				capturedCmd = cmd;
				return null;
			}
		});

		render(GeneralSettings);

		const resetBtn = screen.getByText('generalSettings.resetApplication');
		await fireEvent.click(resetBtn);

		expect(
			screen.getByText('generalSettings.resetApplicationTitle'),
		).toBeTruthy();

		const deleteBtn = screen.getByText('generalSettings.deleteEverything');
		expect(deleteBtn.hasAttribute('disabled')).toBe(true);

		const input = screen.getByPlaceholderText('generalSettings.confirmPhrase');
		await fireEvent.input(input, {
			target: { value: 'generalSettings.confirmPhrase' },
		});

		expect(deleteBtn.hasAttribute('disabled')).toBe(false);
		await fireEvent.click(deleteBtn);

		expect(capturedCmd).toBe('reset_application');

		await tick();
		vi.runAllTimers();
	});

	it('renders offline status and disables update check button when offline', {
		timeout: 10000,
	}, async () => {
		networkStore.isOffline = true;
		render(GeneralSettings);

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

		render(GeneralSettings);

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
		const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
		updateStore.status = 'available';
		updateStore.version = '2.0.0';
		updateStore.installType = 'deb';
		updateStore.installTypeInitialized = true;

		render(GeneralSettings);

		// Assert package manager notice text appears
		expect(screen.getByText('updateSettings.packageManagedTitle')).toBeTruthy();
		expect(screen.getByText('updateSettings.packageManagedDesc')).toBeTruthy();

		// Relaunch or download actions should not be shown
		expect(screen.queryByText('updateSettings.relaunchToApply')).toBeNull();
		expect(screen.queryByText('updateSettings.downloadAndInstall')).toBeNull();

		// Copy command works
		const copyBtn = screen.getByText('updateSettings.copyCommand');
		await fireEvent.click(copyBtn);
		expect(writeText).toHaveBeenCalledWith('updateSettings.debCommand');
	});

	it('exercises the package-manager branch for rpm installs', {
		timeout: 10000,
	}, async () => {
		const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
		updateStore.status = 'available';
		updateStore.version = '2.0.0';
		updateStore.installType = 'rpm';
		updateStore.installTypeInitialized = true;

		render(GeneralSettings);

		// Assert package manager notice text appears
		expect(screen.getByText('updateSettings.packageManagedTitle')).toBeTruthy();
		expect(screen.getByText('updateSettings.packageManagedDesc')).toBeTruthy();

		// Relaunch or download actions should not be shown
		expect(screen.queryByText('updateSettings.relaunchToApply')).toBeNull();
		expect(screen.queryByText('updateSettings.downloadAndInstall')).toBeNull();

		// Copy command works
		const copyBtn = screen.getByText('updateSettings.copyCommand');
		await fireEvent.click(copyBtn);
		expect(writeText).toHaveBeenCalledWith('updateSettings.rpmCommand');
	});
});
