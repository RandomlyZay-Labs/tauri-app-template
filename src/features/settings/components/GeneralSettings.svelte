<script lang="ts">
import * as Tooltip from '@/components/ui/tooltip';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import {
    openDataDirectory,
    openLogDirectory,
    relaunchApp,
    resetApplication,
} from '@/lib/system-utils';
import { clearPersistentStore } from '@/lib/tauri-storage';
import { updateTelemetryConsent } from '@/lib/telemetry';
import { toast } from '@/lib/toast';
import { cn, getSystemAnimationPreference } from '@/lib/utils';
import { animationStore } from '@/stores/animationStore.svelte';
import { themeStore } from '@/stores/themeStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import { updateStore } from '@/stores/updateStore.svelte';
import { networkStore } from '@/stores/networkStore.svelte';
import {
    Database,
    FolderOpen,
    Rocket,
    RotateCcw,
    Trash2,
    RefreshCw,
    Download,
    CheckCircle2,
    AlertCircle,
    Info
} from '@lucide/svelte';
import { onMount } from 'svelte';
import { push } from 'svelte-spa-router';

import { Button } from '@/components/ui/button';
import * as Card from '@/components/ui/card';
import * as Dialog from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

let showResetDialog = $state(false);
let showPrefResetDialog = $state(false);
let deleteConfirmation = $state('');
let relaunchDialogOpen = $state(false);
let copied = $state(false);

const defaultAutoCheck = true;

$effect(() => {
	if (
		updateStore.status === 'downloaded' &&
		updateStore.installTypeInitialized &&
		!updateStore.isPackageManaged
	) {
		relaunchDialogOpen = true;
	}
});

onMount(() => {
});

const confirmPhrase = t('generalSettings.confirmPhrase');

function confirmResetApp() {
        if (deleteConfirmation !== confirmPhrase) return;
        void executeSafeAction(
                async () => {
                        void logger.warn('User initiated full application reset');
                        await resetApplication();
                        await clearPersistentStore();
                        showResetDialog = false;
                        await relaunchApp();
                },
                { errorMessage: t('generalSettings.failedToResetApp') },
        );
}

function handleResetPreferences() {
        themeStore.setTheme('system');
        animationStore.setAnimationsEnabled(getSystemAnimationPreference());
        uiStore.setSidebarOpen(true);
        uiStore.setTelemetryEnabled(false);
        updateTelemetryConsent(false);
        toast.success(t('generalSettings.preferencesResetSuccess'));
        showPrefResetDialog = false;
}

function handleOpenLogs() {
        void executeSafeAction(() => openLogDirectory(), {
                errorMessage: t('generalSettings.couldNotOpenLogDir'),
        });
}

function handleOpenData() {
        void executeSafeAction(() => openDataDirectory(), {
                errorMessage: t('generalSettings.couldNotOpenDataDir'),
        });
}

function handleRerunOnboarding() {
        uiStore.setOnboardingCompleted(false);
        void push('/onboarding');
}

function handleTelemetryToggle(enabled: boolean) {
        uiStore.setTelemetryEnabled(enabled);
        updateTelemetryConsent(enabled);
        toast.success(t('appearanceSettings.settingUpdated', { label: t('generalSettings.telemetry') }));
}

async function copyCommand() {
	const cmd = updateStore.installType === 'deb'
		? t('updateSettings.debCommand')
		: t('updateSettings.rpmCommand');
	await executeSafeAction(
		() => writeText(cmd),
		{
			onSuccess: () => {
				copied = true;
				setTimeout(() => (copied = false), 2000);
			}
		}
	);
}
</script>

<div class="space-y-6">
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

				<!-- Update detailed info & Actions -->
				{#if updateStore.status === 'available' || updateStore.status === 'downloading' || updateStore.status === 'downloaded' || (updateStore.status === 'error' && updateStore.activeUpdate)}
					<div class="mt-4 p-4 rounded-lg border bg-card text-card-foreground space-y-4">
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
									<Button size="sm" variant="ghost" class="h-8 hover:bg-zinc-800 hover:text-zinc-50" onclick={copyCommand}>
										{#if copied}
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
									<Button size="sm" onclick={() => executeSafeAction(() => updateStore.applyUpdate())}>
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

	<Card.Root>
		<Card.Header>
			<Card.Title>{t('generalSettings.storageLogs')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-6">
			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<label for="storage-data-btn" class="text-sm font-medium leading-none">{t('generalSettings.applicationData')}</label>
						</div>
						<Button id="storage-data-btn" variant="outline" onclick={handleOpenData}>
							<Database class="mr-2 size-4" />
							{t('generalSettings.openData')}
						</Button>
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('generalSettings.openDataFolder')}</p>
				</Tooltip.Content>
			</Tooltip.Root>

			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<label for="storage-logs-btn" class="text-sm font-medium leading-none">{t('generalSettings.systemLogs')}</label>
						</div>
						<Button id="storage-logs-btn" variant="outline" onclick={handleOpenLogs}>
							<FolderOpen class="mr-2 size-4" />
							{t('generalSettings.openLogs')}
						</Button>
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('generalSettings.viewLogs')}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{t('generalSettings.telemetry')}</Card.Title>
		</Card.Header>
		<Card.Content>
			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<label for="telemetry-switch" class="text-sm font-medium leading-none">{t('generalSettings.enableTelemetry')}</label>
							<p class="text-muted-foreground text-xs">{t('generalSettings.telemetryStatus')}</p>
						</div>
						<Switch id="telemetry-switch" checked={uiStore.telemetryEnabled} onCheckedChange={handleTelemetryToggle} />
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('generalSettings.telemetryDescription')}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{t('generalSettings.onboarding')}</Card.Title>
		</Card.Header>
		<Card.Content>
			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<label for="rerun-onboarding-btn" class="text-sm font-medium leading-none">{t('generalSettings.rerunOnboarding')}</label>
						</div>
						<Button id="rerun-onboarding-btn" variant="outline" onclick={handleRerunOnboarding}>
							<Rocket class="mr-2 size-4" />
							{t('generalSettings.rerunOnboarding')}
						</Button>
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('generalSettings.onboardingDescription')}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{t('generalSettings.resetDangerZone')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<label for="reset-prefs-btn" class="text-sm font-medium leading-none">{t('generalSettings.resetPreferences')}</label>
						</div>
						<Button id="reset-prefs-btn" variant="outline" onclick={() => (showPrefResetDialog = true)}>
							<RotateCcw class="mr-2 size-4" />
							{t('generalSettings.resetDefaults')}
						</Button>
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('generalSettings.restoreDefaultSettings')}</p>
				</Tooltip.Content>
			</Tooltip.Root>

			<div class="h-px bg-border"></div>

			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<label for="clear-data-btn" class="text-sm font-medium leading-none text-destructive">{t('generalSettings.clearAllData')}</label>
						</div>
						<Button id="clear-data-btn" variant="outline" class="border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive" onclick={() => { deleteConfirmation = ''; showResetDialog = true; }}>
							<Trash2 class="mr-2 size-4" />
							{t('generalSettings.resetApplication')}
						</Button>
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('generalSettings.clearAllDataDescription')}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Card.Content>
	</Card.Root>
</div>

<!-- Reset Preferences Dialog -->
<Dialog.Root bind:open={showPrefResetDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{t('generalSettings.resetPreferencesTitle')}</Dialog.Title>
			<Dialog.Description>{t('generalSettings.resetPreferencesDescription')}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showPrefResetDialog = false)}>{t('common.cancel')}</Button>
			<Button onclick={handleResetPreferences}>{t('generalSettings.confirmReset')}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Reset App Dialog -->
<Dialog.Root bind:open={showResetDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{t('generalSettings.resetApplicationTitle')}</Dialog.Title>
			<Dialog.Description>{t('generalSettings.resetApplicationDescription')}</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-2 py-2">
			<label for="delete-confirmation-input" class="text-muted-foreground text-xs">{t('generalSettings.typeToConfirmPlain')}</label>
			<Input
				id="delete-confirmation-input"
				bind:value={deleteConfirmation}
				placeholder={confirmPhrase}
				class="border-destructive/50 focus-visible:ring-destructive/20"
			/>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showResetDialog = false)}>{t('common.cancel')}</Button>
			<Button variant="destructive" onclick={confirmResetApp} disabled={deleteConfirmation !== confirmPhrase}>{t('generalSettings.deleteEverything')}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

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
