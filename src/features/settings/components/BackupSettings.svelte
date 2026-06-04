<script lang="ts">
import type { BackupMetadata } from '@/bindings';
import * as Tooltip from '@/components/ui/tooltip';
import { executeSafeAction } from '@/lib/async-utils';
import { createBackup, deleteBackup, listBackups, restoreBackup } from '@/lib/backups';
import { t } from '@/lib/i18n';
import { formatSize } from '@/lib/utils';
import { BACKUP_INTERVALS, backupStore } from '@/stores/backupStore.svelte';
import { Archive, HardDriveDownload, Info, RotateCcw, Trash2 } from '@lucide/svelte';
import { format } from 'date-fns';
import { onMount } from 'svelte';

import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import * as Card from '@/components/ui/card';
import * as Dialog from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

let backups = $state<BackupMetadata[]>([]);
let isCreating = $state(false);
let restoreTarget = $state<string | null>(null);
let deleteTarget = $state<string | null>(null);
let showCreateDialog = $state(false);
let backupName = $state('');

let frequencyHours = $state(Math.round(backupStore.interval / (3600 * 1000)));
let retentionCount = $state(backupStore.maxBackups);

$effect(() => {
	frequencyHours = Math.round(backupStore.interval / (3600 * 1000));
});

$effect(() => {
	if (frequencyHours === undefined || frequencyHours === null || Number.isNaN(frequencyHours)) {
		return;
	}
	let clamped = Math.round(frequencyHours);
	if (clamped < 1) clamped = 1;
	if (clamped > 168) clamped = 168;

	const ms = clamped * 3600 * 1000;
	if (ms !== backupStore.interval) {
		backupStore.setInterval(ms);
	}
});

$effect(() => {
	retentionCount = backupStore.maxBackups;
});

$effect(() => {
	if (retentionCount === undefined || retentionCount === null || Number.isNaN(retentionCount)) {
		return;
	}
	let clamped = Math.round(retentionCount);
	if (clamped < 1) clamped = 1;
	if (clamped > 30) clamped = 30;

	if (clamped !== backupStore.maxBackups) {
		backupStore.setMaxBackups(clamped);
	}
});

function formatInterval(hours: number): string {
	if (hours === 1) {
		return t('backupSettings.everyHours', { count: 1 });
	} else if (hours % 24 === 0) {
		const days = hours / 24;
		return t('backupSettings.everyDays', { count: days });
	} else {
		return t('backupSettings.everyHours', { count: hours });
	}
}

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
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<span
									{...props}
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('backupSettings.enableAutoBackup')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</span>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('backupSettings.automatedBackupsDescription')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<Switch
					checked={backupStore.enabled}
					onCheckedChange={() => backupStore.setEnabled(!backupStore.enabled)}
				/>
			</div>

			{#if backupStore.enabled}
				<div class="grid gap-6 md:grid-cols-2">
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<label for="backup-frequency-slider" class="text-sm font-medium">{t('backupSettings.frequency')}</label>
							<span class="text-sm text-muted-foreground font-medium">{formatInterval(frequencyHours)}</span>
						</div>
						<div class="flex items-start gap-4">
							<div class="flex-1">
								<div class="relative pb-6 pt-2">
									<Slider
										id="backup-frequency-slider"
										type="single"
										bind:value={frequencyHours}
										min={1}
										max={168}
										step={1}
									/>
									<div class="absolute inset-x-0 bottom-0 h-4">
										{#each [24, 48, 72, 96, 120, 144] as hour}
											{@const pct = ((hour - 1) / 167) * 100}
											<div class="absolute -translate-x-1/2 flex flex-col items-center" style="left: {pct}%">
												<div class="w-px h-1 bg-muted-foreground/40"></div>
												<span class="text-[9px] text-muted-foreground font-mono mt-0.5">{hour / 24}d</span>
											</div>
										{/each}
									</div>
								</div>
							</div>
							<Input
								type="number"
								min={1}
								max={168}
								bind:value={frequencyHours}
								class="w-20 text-center font-mono h-9"
							/>
						</div>
					</div>
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<label for="backup-retention-slider" class="text-sm font-medium">{t('backupSettings.retention')}</label>
							<span class="text-sm text-muted-foreground font-medium">{t('backupSettings.keepLast', { count: retentionCount })}</span>
						</div>
						<div class="flex items-start gap-4">
							<div class="flex-1">
								<div class="relative pb-6 pt-2">
									<Slider
										id="backup-retention-slider"
										type="single"
										bind:value={retentionCount}
										min={1}
										max={30}
										step={1}
									/>
									<div class="absolute inset-x-0 bottom-0 h-4">
										{#each [5, 10, 15, 20, 25] as count}
											{@const pct = ((count - 1) / 29) * 100}
											<div class="absolute -translate-x-1/2 flex flex-col items-center" style="left: {pct}%">
												<div class="w-px h-1 bg-muted-foreground/40"></div>
												<span class="text-[9px] text-muted-foreground font-mono mt-0.5">{count}</span>
											</div>
										{/each}
									</div>
								</div>
							</div>
							<Input
								type="number"
								min={1}
								max={30}
								bind:value={retentionCount}
								class="w-20 text-center font-mono h-9"
							/>
						</div>
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
											<Badge variant="outline" class="h-5 px-1.5 text-[10px] font-normal bg-background/50">
												{backup.label || t('common.manual')}
											</Badge>
										{/if}
									</div>
									<div class="flex items-center gap-2 text-muted-foreground text-xs">
										<span class="font-mono">{formatSize(backup.size_bytes)}</span>
									</div>
								</div>
								<ButtonGroup>
									<Button data-testid="restore-btn" variant="outline" size="icon" class="size-7" onclick={() => (restoreTarget = backup.id)} title={t('backupSettings.restoreBackup')} aria-label={t('backupSettings.restoreBackup')}>
										<RotateCcw class="size-3.5" />
									</Button>
									<Button data-testid="delete-btn" variant="ghost" size="icon" class="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onclick={() => (deleteTarget = backup.id)} title={t('backupSettings.deleteBackup')} aria-label={t('backupSettings.deleteBackup')}>
										<Trash2 class="size-3.5" />
									</Button>
								</ButtonGroup>
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
					<Spinner class="mr-2" />
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
