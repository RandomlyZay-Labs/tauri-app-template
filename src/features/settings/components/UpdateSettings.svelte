<script lang="ts">
import { Button } from '@/components/ui/button';
import * as Card from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import * as Tooltip from '@/components/ui/tooltip';
import * as Dialog from '@/components/ui/dialog';
import { getAppVersion } from '@/lib/app-version.svelte';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { getCliStatus, installCli } from '@/lib/system-utils';
import { cn } from '@/lib/utils';
import { uiStore } from '@/stores/uiStore.svelte';
import { updateStore } from '@/stores/updateStore.svelte';
import { networkStore } from '@/stores/networkStore.svelte';
import { toast } from '@/lib/toast';
import {
	AlertCircle,
	Check,
	CheckCircle2,
	Copy,
	Download,
	Info,
	RefreshCw,
	RotateCcw,
	Terminal,
} from '@lucide/svelte';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { onMount } from 'svelte';
import { slide } from 'svelte/transition';

let cliStatus = $state<{ installed: boolean; version: string | null } | null>(null);
let isCliLoading = $state(false);
let cliCopied = $state(false);
let packageCommandCopied = $state(false);
let relaunchDialogOpen = $state(false);

const appVersion = $derived(getAppVersion());
const commandText = 'tauri-app-template-cli --help';
const defaultAutoCheck = true;

async function refreshCliStatus() {
	let status: { installed: boolean; version: string | null } | null = null;
	await executeSafeAction(
		async () => {
			status = await getCliStatus();
		},
		{ silent: true }
	);
	if (status) {
		cliStatus = status;
	}
}

onMount(() => {
	// Dismiss update banner when viewing the Updates tab
	updateStore.hasUnseenUpdate = false;
	void refreshCliStatus();
});

async function handleCliCopy() {
	await executeSafeAction(
		() => writeText(commandText),
		{
			onSuccess: () => {
				cliCopied = true;
				setTimeout(() => (cliCopied = false), 2000);
			}
		}
	);
}

async function handlePackageCommandCopy() {
	const cmd = updateStore.installType === 'deb' ? t('updateSettings.debCommand') : t('updateSettings.rpmCommand');
	await executeSafeAction(
		() => writeText(cmd),
		{
			onSuccess: () => {
				packageCommandCopied = true;
				setTimeout(() => (packageCommandCopied = false), 2000);
			}
		}
	);
}

async function handleInstallOrUpdateCli() {
	isCliLoading = true;
	try {
		await executeSafeAction(
			async () => {
				await installCli();
				await refreshCliStatus();
			},
			{
				successMessage: t('cliSettings.installSuccess'),
				errorMessage: t('cliSettings.installFailed')
			}
		);
	} finally {
		isCliLoading = false;
	}
}

const isCliUpToDate = $derived(!!(cliStatus?.installed && cliStatus.version !== null && cliStatus.version === appVersion));
const cliNeedsUpdate = $derived(!!(cliStatus?.installed && cliStatus.version !== null && cliStatus.version !== appVersion));

// Auto open relaunch dialog
$effect(() => {
	if (updateStore.status === 'downloaded' && updateStore.installTypeInitialized && !updateStore.isPackageManaged) {
		if (updateStore.cliUpdateStatus === 'done' || updateStore.cliUpdateStatus === 'error' || updateStore.cliUpdateStatus === 'idle') {
			relaunchDialogOpen = true;
		}
	}
});
</script>

<div class="space-y-6">
	<!-- SECTION 1: App Update Status & Controls -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{t('updateSettings.title')}</Card.Title>
			<Card.Description>{t('updateSettings.description')}</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			<!-- Auto check updates toggle -->
			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<label for="auto-check-switch" class="text-sm font-medium leading-none">{t('updateSettings.autoCheck')}</label>
							<p class="text-muted-foreground text-xs">{t('updateSettings.autoCheckDescription')}</p>
						</div>
						<div class="flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon"
								class={cn("size-8 text-muted-foreground", { 'invisible': uiStore.autoCheckUpdates === defaultAutoCheck })}
								onclick={() => {
									uiStore.setAutoCheckUpdates(defaultAutoCheck);
									toast.success(t('appearanceSettings.settingUpdated', { label: t('updateSettings.autoCheck') }));
								}}
								aria-label={t('updateSettings.resetAutoCheck')}
								aria-hidden={uiStore.autoCheckUpdates === defaultAutoCheck}
								tabindex={uiStore.autoCheckUpdates === defaultAutoCheck ? -1 : 0}
							>
								<RotateCcw class="size-4" />
							</Button>
							<Switch
								id="auto-check-switch"
								checked={uiStore.autoCheckUpdates}
								onCheckedChange={(enabled) => {
									uiStore.setAutoCheckUpdates(enabled);
									toast.success(t('appearanceSettings.settingUpdated', { label: t('updateSettings.autoCheck') }));
								}}
							/>
						</div>
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('updateSettings.autoCheckDescription')}</p>
				</Tooltip.Content>
			</Tooltip.Root>

			<div class="h-px bg-border"></div>

			<!-- Manual check and status -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<span class="text-sm font-medium leading-none">{t('updateSettings.status')}</span>
						<div class="flex items-center gap-2 mt-1">
							{#if networkStore.isOffline}
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
									<AlertCircle class="size-3 mr-1" />
									{t('updateSettings.statusOffline')}
								</span>
							{:else if updateStore.status === 'idle'}
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
									{t('updateSettings.statusIdle')}
								</span>
							{:else if updateStore.status === 'checking'}
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
									<RefreshCw class="animate-spin size-3 mr-1" />
									{t('updateSettings.statusChecking')}
								</span>
							{:else if updateStore.status === 'available'}
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
									<Info class="size-3 mr-1" />
									{t('updateSettings.statusAvailable', { version: updateStore.version })}
								</span>
							{:else if updateStore.status === 'no-update'}
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
									<CheckCircle2 class="size-3 mr-1" />
									{t('updateSettings.statusNoUpdate')}
								</span>
							{:else if updateStore.status === 'downloading'}
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
									<RefreshCw class="animate-spin size-3 mr-1" />
									{t('updateSettings.statusDownloading', { progress: updateStore.percentage })}
								</span>
							{:else if updateStore.status === 'downloaded'}
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
									<CheckCircle2 class="size-3 mr-1" />
									{t('updateSettings.statusDownloaded')}
								</span>
							{:else if updateStore.status === 'error'}
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
									<AlertCircle class="size-3 mr-1" />
									{t('updateSettings.statusError')}
								</span>
							{/if}
						</div>
					</div>
					<Button
						variant="outline"
						onclick={() => executeSafeAction(() => updateStore.checkForUpdates(true))}
						disabled={networkStore.isOffline || updateStore.status === 'checking' || updateStore.status === 'downloading'}
					>
						<RefreshCw class={cn("mr-2 size-4", { 'animate-spin': updateStore.status === 'checking' })} />
						{t('updateSettings.checkUpdates')}
					</Button>
				</div>

				<!-- Update detailed info & Actions (uses transition:slide and gates on activeUpdate) -->
				{#if updateStore.activeUpdate}
					<div transition:slide={{ duration: 200 }} class="mt-4 p-4 rounded-lg border bg-card text-card-foreground space-y-4">
						<div class="space-y-1">
							<h4 class="text-sm font-semibold">{t('updateSettings.updateAvailableTitle')}</h4>
							<p class="text-xs text-muted-foreground">{t('settings.version')}: {updateStore.version} {#if updateStore.date}({updateStore.date}){/if}</p>
						</div>

						{#if updateStore.body}
							<div class="text-xs max-h-32 overflow-y-auto p-2 bg-secondary/30 rounded border">
								<p class="font-mono whitespace-pre-wrap">{updateStore.body}</p>
							</div>
						{/if}

						{#if updateStore.status === 'downloading'}
							<div class="space-y-2">
								<div class="flex items-center justify-between text-xs">
									<span>{t('updateSettings.downloading', { progress: updateStore.percentage })}</span>
									{#if updateStore.contentLength}
										<span>{Math.round(updateStore.downloadedBytes / 1024 / 1024 * 100) / 100}{t('settings.sizeUnit')} / {Math.round(updateStore.contentLength / 1024 / 1024 * 100) / 100}{t('settings.sizeUnit')}</span>
									{/if}
								</div>
								<div class="w-full bg-secondary dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
									<div class="bg-primary h-full rounded-full transition-all duration-200" style="width: {updateStore.percentage}%"></div>
								</div>
							</div>
						{/if}

						<!-- CLI updating indicator during unified update -->
						{#if !updateStore.isPackageManaged && updateStore.cliUpdateStatus === 'updating'}
							<div transition:slide={{ duration: 150 }} class="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded bg-secondary/20 border border-border/40">
								<RefreshCw class="animate-spin size-3.5 text-primary" />
								<span>{t('updateSettings.cliUpdating')}</span>
							</div>
						{/if}

						{#if updateStore.status === 'error' && updateStore.error}
							<div class="p-3 bg-destructive/10 text-destructive text-xs rounded border border-destructive/20 flex items-start gap-2">
								<AlertCircle class="size-4 shrink-0 mt-0.5" />
								<span>{updateStore.error}</span>
							</div>
						{/if}

						{#if updateStore.isPackageManaged}
							<div class="p-4 rounded-lg bg-secondary/30 border space-y-3">
								<div class="flex items-start gap-2">
									<Info class="size-4 shrink-0 mt-0.5 text-primary" />
									<div class="space-y-1">
										<h4 class="text-xs font-semibold">{t('updateSettings.packageManagedTitle')}</h4>
										<p class="text-xs text-muted-foreground">{t('updateSettings.packageManagedDesc')}</p>
									</div>
								</div>
								<div class="flex items-center gap-2 p-2 rounded bg-zinc-950 text-zinc-50 border border-zinc-800 font-mono text-xs">
									<span class="flex-1 select-all">
										{updateStore.installType === 'deb' ? t('updateSettings.debCommand') : t('updateSettings.rpmCommand')}
									</span>
									<Button size="sm" variant="ghost" class="h-8 hover:bg-zinc-800 hover:text-zinc-50" onclick={handlePackageCommandCopy}>
										{#if packageCommandCopied}
											{t('common.copied')}
										{:else}
											{t('updateSettings.copyCommand')}
										{/if}
									</Button>
								</div>
							</div>
						{:else}
							<div class="flex justify-end gap-2">
								{#if updateStore.status === 'available' || updateStore.status === 'error'}
									<Button size="sm" onclick={() => executeSafeAction(() => updateStore.downloadAndInstallUpdate())}>
										<Download class="mr-2 size-4" />
										{t('updateSettings.downloadAndInstall')}
									</Button>
								{:else if updateStore.status === 'downloaded'}
									<Button size="sm" onclick={() => executeSafeAction(() => updateStore.applyUpdate())} disabled={updateStore.cliUpdateStatus === 'updating'}>
										<RefreshCw class="mr-2 size-4" />
										{t('updateSettings.relaunchToApply')}
									</Button>
								{/if}
							</div>
						{/if}
					</div>
				{/if}

				{#if updateStore.status === 'error' && !updateStore.activeUpdate && updateStore.error}
					<div class="mt-4 p-4 rounded-lg border border-destructive/20 bg-destructive/5 dark:bg-destructive/10 text-card-foreground space-y-2">
						<div class="flex items-start gap-2 text-destructive">
							<AlertCircle class="size-4 shrink-0 mt-0.5" />
							<div class="space-y-1">
								<h4 class="text-sm font-semibold">{t('updateSettings.checkFailed')}</h4>
								<p class="text-xs text-muted-foreground">{updateStore.error}</p>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<!-- SECTION 2: CLI Integration -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{t('updateSettings.cliSection')}</Card.Title>
			<Card.Description>{t('cliSettings.description')}</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			<div class="flex items-center justify-between border-b pb-4">
				<div class="space-y-1">
					<p class="text-sm font-medium leading-none">{t('cliSettings.status')}</p>
					<p class="text-muted-foreground text-xs mt-1 flex items-center gap-1.5">
						{#if cliStatus === null}
							{t('common.loading')}...
						{:else if !cliStatus.installed}
							<span class="text-destructive flex items-center gap-1">
								<AlertCircle class="size-3" />
								{t('cliSettings.notInstalled')}
							</span>
						{:else if cliStatus.version === null}
							<span class="text-amber-500 flex items-center gap-1">
								<AlertCircle class="size-3" />
								{t('cliSettings.unknownVersion')}
							</span>
						{:else if isCliUpToDate}
							<span class="text-green-500 flex items-center gap-1">
								<CheckCircle2 class="size-3" />
								{t('cliSettings.upToDate')} ({t('updateSettings.cliCurrentVersion')}: v{cliStatus.version})
							</span>
						{:else}
							<span class="text-amber-500 flex items-center gap-1">
								<RefreshCw class="size-3 animate-spin duration-150 animate-duration-snappy" />
								{t('cliSettings.versionMismatch')} (v{cliStatus.version} vs v{appVersion})
							</span>
						{/if}
					</p>
					{#if !updateStore.isPackageManaged && cliStatus?.installed}
						<p class="text-[10px] text-muted-foreground mt-0.5">
							{t('updateSettings.cliManagedByApp')}
						</p>
					{/if}
				</div>

				<!-- Installation / Update Controls -->
				{#if updateStore.isPackageManaged}
					<!-- Package-managed: Independent manual installer/updater -->
					<Button 
						variant={cliNeedsUpdate ? "default" : "outline"} 
						disabled={isCliLoading || isCliUpToDate || cliStatus === null}
						onclick={handleInstallOrUpdateCli}
					>
						{#if isCliLoading}
							<RefreshCw class="mr-2 size-4 animate-spin duration-150 animate-duration-snappy" />
							{t('common.loading')}...
						{:else if cliNeedsUpdate}
							<RefreshCw class="mr-2 size-4" />
							{t('cliSettings.updateCli')}
						{:else if !cliStatus?.installed}
							<Download class="mr-2 size-4" />
							{t('cliSettings.installCli')}
						{:else}
							<CheckCircle2 class="mr-2 size-4" />
							{t('cliSettings.installed')}
						{/if}
					</Button>
				{:else}
					<!-- Bundled: Auto-managed, only show Install button if not installed at all -->
					{#if cliStatus && !cliStatus.installed}
						<Button 
							variant="default" 
							disabled={isCliLoading}
							onclick={handleInstallOrUpdateCli}
						>
							{#if isCliLoading}
								<RefreshCw class="mr-2 size-4 animate-spin duration-150 animate-duration-snappy" />
								{t('common.loading')}...
							{:else}
								<Download class="mr-2 size-4" />
								{t('cliSettings.installCli')}
							{/if}
						</Button>
					{:else if cliStatus?.installed}
						<span class="text-xs text-muted-foreground px-3 py-1.5 rounded-md bg-secondary/50 border flex items-center gap-1.5">
							<Check class="size-3.5 text-green-500" />
							{t('cliSettings.installed')}
						</span>
					{/if}
				{/if}
			</div>

			<!-- CLI usage guidance and notes -->
			<div class="space-y-4">
				<div class="space-y-2">
					<h4 class="text-sm font-medium">{t('cliSettings.howToUse')}</h4>
					<p class="text-muted-foreground text-xs leading-relaxed">
						{t('cliSettings.usageDescription')}
					</p>
				</div>

				<div class="group relative">
					<div class="flex items-center justify-between rounded-lg border bg-muted/50 p-3 transition-colors group-hover:bg-muted/80">
						<code class="font-mono text-xs text-foreground/90">
							{commandText}
						</code>
						<Tooltip.Root delayDuration={0}>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="outline"
										size="icon-xs"
										class={cn(
											"size-7 transition-all duration-150 animate-duration-snappy",
											cliCopied ? "border-green-500/50 bg-green-500/10 text-green-600" : "hover:bg-background"
										)}
										onclick={handleCliCopy}
									>
										{#if cliCopied}
											<Check class="size-3.5 transition-all animate-in zoom-in" />
										{:else}
											<Copy class="size-3.5 transition-all" />
										{/if}
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="top" class="px-2 py-1 text-[10px]">
								<p>{cliCopied ? t('common.copied') : t('common.copy')}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</div>
				</div>

				<div class="rounded-lg border bg-muted/30 p-4">
					<div class="flex gap-3">
						<Terminal class="size-5 text-muted-foreground shrink-0 mt-0.5" />
						<div class="space-y-1">
							<p class="text-xs font-medium">{t('cliSettings.pathNoteTitle')}</p>
							<p class="text-xs text-muted-foreground leading-relaxed">
								{t('cliSettings.pathNoteDescription')}
							</p>
						</div>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- Relaunch Dialog -->
<Dialog.Root bind:open={relaunchDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{t('updateSettings.relaunchToApply')}</Dialog.Title>
			<Dialog.Description>
				{t('updateSettings.relaunchDescription')}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (relaunchDialogOpen = false)}>{t('appearanceSettings.later')}</Button>
			<Button onclick={() => executeSafeAction(() => updateStore.applyUpdate())}>{t('appearanceSettings.restartNow')}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
