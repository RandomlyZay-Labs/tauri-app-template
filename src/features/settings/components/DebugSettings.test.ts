import { mockIPC } from '@tauri-apps/api/mocks';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trayStore } from '@/stores/trayStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import TestWrapper from '@/test/TestWrapper.svelte';
import DebugSettings from './DebugSettings.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string, _params?: unknown) => key),
}));

// Mock toast
vi.mock('@/lib/toast', () => ({
	toast: {
		info: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe('DebugSettings', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		uiStore.setLogLevel('error');
		trayStore.setMinimizeToTray(false);

		// Mock window.Notification for Tauri 2 plugin-notification
		// @ts-expect-error
		window.Notification = {
			permission: 'granted',
			requestPermission: vi.fn(() => Promise.resolve('granted')),
		};

		mockIPC((cmd) => {
			if (cmd === 'plugin:dialog|message') return Promise.resolve('Yes');
			if (cmd === 'plugin:dialog|save')
				return Promise.resolve('/path/to/logs.txt');
			if (cmd === 'plugin:process|restart') return Promise.resolve(null);
			if (cmd === 'plugin:process|exit') return Promise.resolve(null);
			if (cmd === 'plugin:notification|is_permission_granted')
				return Promise.resolve(true);
			if (cmd === 'notify') return Promise.resolve(null);
			if (cmd === 'export_diagnostics') return Promise.resolve(true);
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('renders debug settings controls', () => {
		render(TestWrapper, { props: { component: DebugSettings } });

		expect(screen.getByText('debugSettings.title')).toBeTruthy();
		expect(screen.getByText('debugSettings.minimizeToTray')).toBeTruthy();
	});

	it('toggles minimize to tray when switch is clicked', async () => {
		render(TestWrapper, { props: { component: DebugSettings } });

		const switches = screen.getAllByRole('switch');
		// First switch is minimizeToTray
		await fireEvent.click(switches[0]);

		expect(trayStore.minimizeToTray).toBe(true);
	});

	it('resets notify when minimized when reset button is clicked', async () => {
		trayStore.setMinimizeToTray(true);
		trayStore.setNotifyOnMinimize(false);
		render(TestWrapper, { props: { component: DebugSettings } });

		const resetButtons = screen.getAllByTitle('common.reset');
		// Second reset button is for notifyOnMinimize
		await fireEvent.click(resetButtons[1]);

		expect(trayStore.notifyOnMinimize).toBe(true);
	});

	it('toggles debug mode when switch is clicked', async () => {
		render(TestWrapper, { props: { component: DebugSettings } });

		const switches = screen.getAllByRole('switch');
		// Fourth switch is debug mode
		await fireEvent.click(switches[3]);

		expect(uiStore.logLevel).toBe('debug');
	});

	it('exports diagnostics when button is clicked', async () => {
		const { toast } = await import('@/lib/toast');
		let capturedExport = false;
		mockIPC((cmd) => {
			if (cmd === 'export_diagnostics') {
				capturedExport = true;
				return Promise.resolve(true);
			}
			if (cmd === 'plugin:dialog|save')
				return Promise.resolve('/path/to/logs.txt');
		});

		render(TestWrapper, { props: { component: DebugSettings } });
		const btn = screen.getByText('debugSettings.exportLogs');
		await fireEvent.click(btn);

		expect(capturedExport).toBe(true);
		await waitFor(() => {
			expect(toast.success).toHaveBeenCalledWith(
				'debugSettings.exportLogsSuccess',
			);
		});
	});

	it('handles failure when exporting diagnostics', async () => {
		mockIPC((cmd) => {
			if (cmd === 'export_diagnostics') {
				return Promise.reject(new Error('Export failed'));
			}
			if (cmd === 'plugin:dialog|save')
				return Promise.resolve('/path/to/logs.txt');
		});

		render(TestWrapper, { props: { component: DebugSettings } });
		const btn = screen.getByText('debugSettings.exportLogs');
		await fireEvent.click(btn);
	});
});
