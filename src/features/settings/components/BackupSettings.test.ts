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
import type { BackupMetadata } from '@/bindings';
import { backupStore } from '@/stores/backupStore.svelte';
import TestWrapper from '@/test/TestWrapper.svelte';
import BackupSettings from './BackupSettings.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string, _params?: unknown) => key),
}));

describe('BackupSettings', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		backupStore.setEnabled(false);

		mockIPC((cmd) => {
			if (cmd === 'list_backups') return [];
			if (cmd === 'create_backup') return {};
			if (cmd === 'delete_backup') return null;
			if (cmd === 'restore_backup') return null;
		});
	});

	afterEach(() => {
		cleanup();
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	it('renders backup settings controls', async () => {
		render(TestWrapper, { props: { component: BackupSettings } });

		expect(screen.getByText('backupSettings.automatedBackups')).toBeTruthy();
		expect(screen.getByText('backupSettings.backupHistory')).toBeTruthy();
	});

	it('toggles automated backups when switch is clicked', async () => {
		render(TestWrapper, { props: { component: BackupSettings } });

		const toggle = screen.getByRole('switch');
		await fireEvent.click(toggle);

		expect(backupStore.enabled).toBe(true);
	});

	it('shows no backups message when history is empty', async () => {
		render(TestWrapper, { props: { component: BackupSettings } });

		await waitFor(() => {
			expect(screen.getByText('backupSettings.noBackupsFound')).toBeTruthy();
		});
	});

	it('renders list of backups when available', async () => {
		const mockBackups: BackupMetadata[] = [
			{
				id: '1',
				created_at: new Date().toISOString(),
				size_bytes: 1024,
				is_manual: false,
				label: null,
			},
			{
				id: '2',
				created_at: new Date().toISOString(),
				size_bytes: 2048,
				is_manual: true,
				label: 'Manual',
			},
		];

		mockIPC((cmd) => {
			if (cmd === 'list_backups') return mockBackups;
		});

		render(TestWrapper, { props: { component: BackupSettings } });

		await waitFor(() => {
			const rows = screen.getAllByTestId('backup-row');
			expect(rows.length).toBe(2);
		});
	});

	it('opens create backup dialog when clicking the button', async () => {
		render(TestWrapper, { props: { component: BackupSettings } });

		const createBtn = screen.getByText('backupSettings.createBackup');
		await fireEvent.click(createBtn);

		expect(screen.getByText('backupSettings.createManualBackup')).toBeTruthy();
	});

	it('confirms backup deletion', async () => {
		const mockBackups: BackupMetadata[] = [
			{
				id: '1',
				created_at: new Date().toISOString(),
				size_bytes: 1024,
				is_manual: false,
				label: null,
			},
		];

		let capturedCmd: string | null = null;
		let capturedArgs: unknown = null;

		mockIPC((cmd, args) => {
			if (cmd === 'list_backups') return mockBackups;
			if (cmd === 'delete_backup') {
				capturedCmd = cmd;
				capturedArgs = args;
				return null;
			}
		});

		render(TestWrapper, { props: { component: BackupSettings } });

		await waitFor(() => {
			const deleteBtn = screen.getByTestId('delete-btn');
			fireEvent.click(deleteBtn);
		});

		await waitFor(() => {
			expect(screen.getByText('backupSettings.confirmDelete')).toBeTruthy();
		});

		const confirmDeleteBtn = screen.getByText('backupSettings.deleteBackup');
		await fireEvent.click(confirmDeleteBtn);

		expect(capturedCmd).toBe('delete_backup');
		expect(capturedArgs).toEqual({ backupId: '1' });
	});

	it('confirms backup restoration', async () => {
		const mockBackups: BackupMetadata[] = [
			{
				id: '1',
				created_at: new Date().toISOString(),
				size_bytes: 1024,
				is_manual: false,
				label: null,
			},
		];

		let capturedCmd: string | null = null;
		let capturedArgs: unknown = null;

		mockIPC((cmd, args) => {
			if (cmd === 'list_backups') return mockBackups;
			if (cmd === 'restore_backup') {
				capturedCmd = cmd;
				capturedArgs = args;
				return null;
			}
		});

		render(TestWrapper, { props: { component: BackupSettings } });

		await waitFor(() => {
			const restoreBtn = screen.getByTestId('restore-btn');
			fireEvent.click(restoreBtn);
		});

		await waitFor(() => {
			expect(screen.getByText('backupSettings.confirmRestore')).toBeTruthy();
		});

		const confirmRestoreBtn = screen.getByText(
			'backupSettings.restoreAndRestart',
		);
		await fireEvent.click(confirmRestoreBtn);

		expect(capturedCmd).toBe('restore_backup');
		expect(capturedArgs).toEqual({ backupId: '1' });
	});

	it('updates frequency and retention in store when sliders change', async () => {
		backupStore.setEnabled(true);
		render(TestWrapper, { props: { component: BackupSettings } });

		expect(screen.getByText('backupSettings.frequency')).toBeTruthy();
		expect(screen.getByText('backupSettings.retention')).toBeTruthy();

		backupStore.setInterval(12 * 3600 * 1000); // 12 hours
		backupStore.setMaxBackups(15);

		await tick();

		expect(screen.getByText('backupSettings.everyHours')).toBeTruthy();
		expect(screen.getByText('backupSettings.keepLast')).toBeTruthy();
	});

	it('updates frequency and retention in store when inputs change', async () => {
		backupStore.setEnabled(true);
		render(TestWrapper, { props: { component: BackupSettings } });

		const inputs = screen.getAllByRole('spinbutton');
		expect(inputs.length).toBe(2);

		// First input is frequencyHours
		await fireEvent.input(inputs[0], { target: { value: '48' } });
		expect(backupStore.interval).toBe(48 * 3600 * 1000);

		// Second input is retentionCount
		await fireEvent.input(inputs[1], { target: { value: '20' } });
		expect(backupStore.maxBackups).toBe(20);
	});
});
