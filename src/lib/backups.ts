// SPDX-License-Identifier: MIT
import type { BackupMetadata } from '@/bindings';
import { commands } from '@/lib/ipc';

export async function listBackups(): Promise<BackupMetadata[]> {
	return await commands.listBackups();
}

export async function createBackup(
	label: string | null,
	isManual?: boolean | null,
): Promise<BackupMetadata> {
	return await commands.createBackup(label, isManual ?? null);
}

export async function deleteBackup(id: string): Promise<null> {
	return await commands.deleteBackup(id);
}

export async function restoreBackup(id: string): Promise<null> {
	return await commands.restoreBackup(id);
}
