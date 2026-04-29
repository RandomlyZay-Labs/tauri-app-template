<script lang="ts">
import type { BackupMetadata } from '@/bindings';
import * as Tooltip from '@/components/ui/tooltip';
import { executeSafeAction } from '@/lib/async-utils';
import { createBackup, deleteBackup, listBackups, restoreBackup } from '@/lib/backups';
import { t } from '@/lib/i18n';
import { formatSize } from '@/lib/utils';
import { BACKUP_INTERVALS, backupStore } from '@/stores/backupStore.svelte';
import { Archive, HardDriveDownload, Loader2, RotateCcw, Trash2 } from '@lucide/svelte';
import { format } from 'date-fns';
import { onMount } from 'svelte';

import { Button } from '@/components/ui/button';
import * as Card from '@/components/ui/card';
import * as Dialog from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as Select from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

let backups = $state<BackupMetadata[]>([]);
let isCreating = $state(false);
let restoreTarget = $state<string | null>(null);
let deleteTarget = $state<string | null>(null);
let showCreateDialog = $state(false);
let backupName = $state('');

const intervalLabels: Record<number, string> = {
	[BACKUP_INTERVALS.HOURLY]: t('backupSettings.everyHour'),
	[BACKUP_INTERVALS.DAILY]: t('backupSettings.daily'),
	[BACKUP_INTERVALS.WEEKLY]: t('backupSettings.weekly'),
};

async function loadBackups() {
	try {
		backups = await listBackups();
	} catch {
		backups = [];
	}
}

onMount(() => {
	void loadBackups();
});

function handleCreateSubmit() {
	if (!backupName.trim()) return;
	isCreating = true;
	void executeSafeAction(
		async () => {
			await createBackup(backupName);
			showCreateDialog = false;
			backupName = '';
			await loadBackups();
		},
		{
			successMessage: t('backupSettings.manualBackupCreated'),
			errorMessage: t('backupSettings.failedToCreateBackup'),
			onSuccess: () => {
				isCreating = false;
			},
			onError: () => {
				isCreating = false;
			},
		},
	);
}

function confirmDelete() {
	if (!deleteTarget) return;
	void executeSafeAction(
		async () => {
			await deleteBackup(deleteTarget!);
			deleteTarget = null;
			await loadBackups();
		},
		{
			successMessage: t('backupSettings.backupDeleted'),
			errorMessage: t('backupSettings.backupDeleteFailed'),
		},
	);
}

function handleRestore() {
	if (!restoreTarget) return;
	void executeSafeAction(
		async () => {
			await restoreBackup(restoreTarget!);
			restoreTarget = null;
		},
		{ errorMessage: t('backupSettings.failedToRestore') },
	);
}
</script>

<div class="space-y-6">
	<!-- Automated Backups -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{t('backupSettings.automatedBackups')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-6">
			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<span class="text-base font-medium block">{t('backupSettings.enableAutoBackup')}</span>
						</div>
						<Switch
							checked={backupStore.enabled}
							onCheckedChange={() => backupStore.setEnabled(!backupStore.enabled)}
						/>
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('backupSettings.automatedBackupsDescription')}</p>
				</Tooltip.Content>
			</Tooltip.Root>

			{#if backupStore.enabled}
				<div class="grid gap-6 md:grid-cols-2">
					<div class="space-y-2">
						<label for="backup-frequency-select" class="text-sm font-medium block">{t('backupSettings.frequency')}</label>
						<Select.Root
							type="single"
							value={backupStore.interval.toString()}
							onValueChange={(val) => backupStore.setInterval(Number(val))}
						>
							<Select.Trigger id="backup-frequency-select" class="w-full">
								{#if backupStore.interval === BACKUP_INTERVALS.HOURLY}
									{t('backupSettings.everyHour')}
								{:else if backupStore.interval === BACKUP_INTERVALS.DAILY}
									{t('backupSettings.daily')}
								{:else}
									{t('backupSettings.weekly')}
								{/if}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value={BACKUP_INTERVALS.HOURLY.toString()}>{t('backupSettings.everyHour')}</Select.Item>
								<Select.Item value={BACKUP_INTERVALS.DAILY.toString()}>{t('backupSettings.daily')}</Select.Item>
								<Select.Item value={BACKUP_INTERVALS.WEEKLY.toString()}>{t('backupSettings.weekly')}</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
					<div class="space-y-2">
						<label for="backup-retention-select" class="text-sm font-medium block">{t('backupSettings.retention')}</label>
						<Select.Root
							type="single"
							value={backupStore.maxBackups.toString()}
							onValueChange={(val) => backupStore.setMaxBackups(Number(val))}
						>
							<Select.Trigger id="backup-retention-select" class="w-full">
								{t('backupSettings.keepLast', { count: backupStore.maxBackups })}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="3">{t('backupSettings.keepLast', { count: 3 })}</Select.Item>
								<Select.Item value="5">{t('backupSettings.keepLast', { count: 5 })}</Select.Item>
								<Select.Item value="10">{t('backupSettings.keepLast', { count: 10 })}</Select.Item>
								<Select.Item value="20">{t('backupSettings.keepLast', { count: 20 })}</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Backup History -->
	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-6">
			<div class="space-y-1.5">
				<Card.Title>{t('backupSettings.backupHistory')}</Card.Title>
			</div>
			<Button onclick={() => (showCreateDialog = true)} disabled={isCreating}>
				<Archive class="mr-2 size-4" />
				{t('backupSettings.createBackup')}
			</Button>
		</Card.Header>
		<Card.Content>
			{#if backups.length === 0}
				<div class="py-8 text-center text-muted-foreground text-sm">{t('backupSettings.noBackupsFound')}</div>
			{:else}
				<ScrollArea class="h-75 w-full pr-4">
					<div class="space-y-2">
						{#each backups as backup (backup.id)}
							{@const isManual = backup.is_manual || !!backup.label}
							<div data-testid="backup-row" class="flex items-center justify-between rounded-lg border p-3 transition-colors {isManual ? 'border-primary/20 bg-primary/5' : 'bg-muted/20'}">
								<div class="space-y-1">
									<div class="flex items-center gap-2">
										<span class="font-medium text-sm">{format(new Date(backup.created_at), 'PPP p')}</span>
										{#if isManual}
											<span class="inline-flex h-5 items-center rounded-full border bg-background/50 px-1.5 text-[10px] font-normal">
												{backup.label || t('common.manual')}
											</span>
										{/if}
									</div>
									<div class="flex items-center gap-2 text-muted-foreground text-xs">
										<span class="font-mono">{formatSize(backup.size_bytes)}</span>
									</div>
								</div>
								<div class="flex gap-2">
									<Button data-testid="restore-btn" variant="outline" size="icon" class="size-7" onclick={() => (restoreTarget = backup.id)} title={t('backupSettings.restoreBackup')} aria-label={t('backupSettings.restoreBackup')}>
										<RotateCcw class="size-3.5" />
									</Button>
									<Button data-testid="delete-btn" variant="ghost" size="icon" class="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onclick={() => (deleteTarget = backup.id)} title={t('backupSettings.deleteBackup')} aria-label={t('backupSettings.deleteBackup')}>
										<Trash2 class="size-3.5" />
									</Button>
								</div>
							</div>
						{/each}
					</div>
				</ScrollArea>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<!-- Create Backup Dialog -->
<Dialog.Root bind:open={showCreateDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{t('backupSettings.createManualBackup')}</Dialog.Title>
			<Dialog.Description>{t('backupSettings.createManualBackupDescription')}</Dialog.Description>
		</Dialog.Header>
		<div class="py-2">
			<label for="backup-name" class="mb-2 block text-sm font-medium">{t('backupSettings.backupName')}</label>
			<Input id="backup-name" autofocus bind:value={backupName} placeholder={t('backupSettings.backupNamePlaceholder')} onkeydown={(e) => { if (e.key === 'Enter') handleCreateSubmit(); }} />
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showCreateDialog = false)}>{t('common.cancel')}</Button>
			<Button onclick={handleCreateSubmit} disabled={!backupName.trim() || isCreating}>
				{#if isCreating}
					<Loader2 class="mr-2 size-4 animate-spin" />
					{t('backupSettings.creating')}
				{:else}
					{t('backupSettings.createBackup')}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation Dialog -->
<Dialog.Root open={!!deleteTarget} onOpenChange={(v) => { if (!v) deleteTarget = null; }}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{t('backupSettings.confirmDelete')}</Dialog.Title>
			<Dialog.Description>{t('backupSettings.confirmDeleteDescription')}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteTarget = null)}>{t('common.cancel')}</Button>
			<Button variant="destructive" onclick={confirmDelete}>
				<Trash2 class="mr-2 size-4" />
				{t('backupSettings.deleteBackup')}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Restore Confirmation Dialog -->
<Dialog.Root open={!!restoreTarget} onOpenChange={(v) => { if (!v) restoreTarget = null; }}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{t('backupSettings.confirmRestore')}</Dialog.Title>
			<Dialog.Description>{t('backupSettings.confirmRestoreDescriptionPlain')}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (restoreTarget = null)}>{t('common.cancel')}</Button>
			<Button onclick={handleRestore}>
				<HardDriveDownload class="mr-2 size-4" />
				{t('backupSettings.restoreAndRestart')}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
