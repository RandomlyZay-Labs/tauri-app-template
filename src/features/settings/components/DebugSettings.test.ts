// SPDX-License-Identifier: MIT
import { mockIPC } from '@tauri-apps/api/mocks';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

		mockIPC((cmd) => {
			if (cmd === 'plugin:dialog|message') return Promise.resolve('Yes');
			if (cmd === 'plugin:dialog|save')
				return Promise.resolve('/path/to/logs.txt');
			if (cmd === 'plugin:process|restart') return Promise.resolve(null);
			if (cmd === 'plugin:process|exit') return Promise.resolve(null);
			if (cmd === 'export_diagnostics') return Promise.resolve(true);
			if (cmd === 'open_log_dir') return null;
			if (cmd === 'open_data_dir') return null;
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('renders debug settings controls', () => {
		render(TestWrapper, { props: { component: DebugSettings } });

		expect(screen.getByText('debugSettings.title')).toBeTruthy();
		expect(screen.getByText('generalSettings.applicationData')).toBeTruthy();
		expect(screen.getByText('generalSettings.systemLogs')).toBeTruthy();
	});

	it('opens log directory when button is clicked', async () => {
		let capturedCmd: string | null = null;
		mockIPC((cmd) => {
			if (cmd === 'open_log_dir') {
				capturedCmd = cmd;
				return null;
			}
		});

		render(TestWrapper, { props: { component: DebugSettings } });

		const btn = screen.getByText('generalSettings.openLogs');
		await fireEvent.click(btn);

		expect(capturedCmd).toBe('open_log_dir');
	});

	it('opens data directory when button is clicked', async () => {
		let capturedCmd: string | null = null;
		mockIPC((cmd) => {
			if (cmd === 'open_data_dir') {
				capturedCmd = cmd;
				return null;
			}
		});

		render(TestWrapper, { props: { component: DebugSettings } });

		const btn = screen.getByText('generalSettings.openData');
		await fireEvent.click(btn);

		expect(capturedCmd).toBe('open_data_dir');
	});

	it('toggles debug mode when switch is clicked', async () => {
		render(TestWrapper, { props: { component: DebugSettings } });

		const switches = screen.getAllByRole('switch');
		// Second switch is debug mode (index 1)
		await fireEvent.click(switches[1]);

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
