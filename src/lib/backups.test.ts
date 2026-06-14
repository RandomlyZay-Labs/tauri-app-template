// SPDX-License-Identifier: MIT
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '@/lib/ipc';
import {
	createBackup,
	deleteBackup,
	listBackups,
	restoreBackup,
} from './backups';

vi.mock('@/lib/ipc', () => ({
	commands: {
		listBackups: vi.fn(),
		createBackup: vi.fn(),
		deleteBackup: vi.fn(),
		restoreBackup: vi.fn(),
	},
}));

describe('backups utility', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('listBackups calls commands.listBackups', async () => {
		const mockBackups = [
			{ id: '1', label: 'test', size: 100, createdAt: '2023-01-01' },
		];
		vi.mocked(commands.listBackups).mockResolvedValue(mockBackups);

		const result = await listBackups();

		expect(commands.listBackups).toHaveBeenCalled();
		expect(result).toBe(mockBackups);
	});

	it('createBackup calls commands.createBackup with label', async () => {
		const mockBackup = {
			id: '2',
			label: 'new',
			size: 200,
			createdAt: '2023-01-02',
		};
		vi.mocked(commands.createBackup).mockResolvedValue(mockBackup);

		const result = await createBackup('new');

		expect(commands.createBackup).toHaveBeenCalledWith('new', null);
		expect(result).toBe(mockBackup);
	});

	it('createBackup calls commands.createBackup with label and isManual', async () => {
		const mockBackup = {
			id: '2',
			label: 'new',
			size: 200,
			createdAt: '2023-01-02',
		};
		vi.mocked(commands.createBackup).mockResolvedValue(mockBackup);

		const result = await createBackup('new', false);

		expect(commands.createBackup).toHaveBeenCalledWith('new', false);
		expect(result).toBe(mockBackup);
	});

	it('deleteBackup calls commands.deleteBackup with id', async () => {
		vi.mocked(commands.deleteBackup).mockResolvedValue(null);

		await deleteBackup('1');

		expect(commands.deleteBackup).toHaveBeenCalledWith('1');
	});

	it('restoreBackup calls commands.restoreBackup with id', async () => {
		vi.mocked(commands.restoreBackup).mockResolvedValue(null);

		await restoreBackup('1');

		expect(commands.restoreBackup).toHaveBeenCalledWith('1');
	});
});
