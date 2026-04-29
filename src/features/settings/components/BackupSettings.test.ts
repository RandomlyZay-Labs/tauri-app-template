import { mockIPC } from '@tauri-apps/api/mocks';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackupMetadata } from '@/bindings';
import { backupStore } from '@/stores/backupStore.svelte';
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
		render(BackupSettings);

		expect(screen.getByText('backupSettings.automatedBackups')).toBeTruthy();
		expect(screen.getByText('backupSettings.backupHistory')).toBeTruthy();
	});

	it('toggles automated backups when switch is clicked', async () => {
		render(BackupSettings);

		const toggle = screen.getByRole('switch');
		await fireEvent.click(toggle);

		expect(backupStore.enabled).toBe(true);
	});

	it('shows no backups message when history is empty', async () => {
		render(BackupSettings);

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

		render(BackupSettings);

		await waitFor(() => {
			const rows = screen.getAllByTestId('backup-row');
			expect(rows.length).toBe(2);
		});
	});

	it('opens create backup dialog when clicking the button', async () => {
		render(BackupSettings);

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

		render(BackupSettings);

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

		render(BackupSettings);

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
});
