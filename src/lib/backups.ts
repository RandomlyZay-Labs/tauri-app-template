import type { BackupMetadata } from '@/bindings';
import { commands } from '@/lib/ipc';

export async function listBackups(): Promise<BackupMetadata[]> {
	return await commands.listBackups();
}

export async function createBackup(
	label: string | null,
): Promise<BackupMetadata> {
	return await commands.createBackup(label);
}

export async function deleteBackup(id: string): Promise<null> {
	return await commands.deleteBackup(id);
}

export async function restoreBackup(id: string): Promise<null> {
	return await commands.restoreBackup(id);
}
