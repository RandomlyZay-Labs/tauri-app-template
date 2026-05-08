import { mockIPC } from '@tauri-apps/api/mocks';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiStore } from '@/stores/uiStore.svelte';
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

		mockIPC((cmd) => {
			if (cmd === 'open_log_dir') return null;
			if (cmd === 'open_data_dir') return null;
			if (cmd === 'reset_application') return null;
			if (cmd === 'is_appimage') return false;
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
		const toggle = screen.getByRole('switch');
		await fireEvent.click(toggle);

		expect(uiStore.telemetryEnabled).toBe(!initialValue);
		expect(updateTelemetryConsent).toHaveBeenCalledWith(!initialValue);
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

	it('shows path success dialog when integrateAppImage is successful', {
		timeout: 10000,
	}, async () => {
		mockIPC((cmd) => {
			if (cmd === 'is_appimage') return true;
			if (cmd === 'integrate_appimage') return null;
		});

		render(GeneralSettings);

		// Wait for onMount and isAppImage state to update
		await tick();
		await tick();

		const integrateBtn = await screen.findByText('generalSettings.addToPath');
		await fireEvent.click(integrateBtn);

		await tick();
		await tick();

		expect(screen.getByText('generalSettings.pathSuccessTitle')).toBeTruthy();
		expect(screen.getByText('generalSettings.pathSuccessMessage')).toBeTruthy();
	});
});
