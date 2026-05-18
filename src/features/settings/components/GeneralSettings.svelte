<script lang="ts">
import * as Tooltip from '@/components/ui/tooltip';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import {
    checkIsAppImage,
    integrateAppImage,
    openDataDirectory,
    openLogDirectory,
    relaunchApp,
    resetApplication,
} from '@/lib/system-utils';
import { clearPersistentStore } from '@/lib/tauri-storage';
import { updateTelemetryConsent } from '@/lib/telemetry';
import { toast } from '@/lib/toast';
import { getSystemAnimationPreference } from '@/lib/utils';
import { animationStore } from '@/stores/animationStore.svelte';
import { themeStore } from '@/stores/themeStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import {
    Database,
    FolderOpen,
    Rocket,
    RotateCcw,
    Terminal,
    Trash2,
    Copy,
    Check
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
let isAppImage = $state(false);
let showPathSuccessDialog = $state(false);
let copied = $state(false);

onMount(() => {
        void checkIsAppImage().then((v) => (isAppImage = v));
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

function handleIntegrateAppImage() {
        void executeSafeAction(
                async () => {
                        await integrateAppImage();
                        showPathSuccessDialog = true;
                },
                { errorMessage: t('generalSettings.failedToAddPath') },
        );
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
        await writeText('tauri-app-template');
        copied = true;
        setTimeout(() => (copied = false), 2000);
}
</script>

<div class="space-y-6">
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

	{#if isAppImage}
		<Card.Root>
			<Card.Header>
				<Card.Title>{t('generalSettings.appImage')}</Card.Title>
			</Card.Header>
			<Card.Content>
				<Tooltip.Root>
					<Tooltip.Trigger class="w-full text-left">
						<div class="flex items-center justify-between">
							<div class="space-y-0.5">
								<label for="appimage-integrate-btn" class="text-sm font-medium leading-none">{t('generalSettings.appImageIntegration')}</label>
							</div>
							<Button id="appimage-integrate-btn" variant="outline" onclick={handleIntegrateAppImage}>
								<Terminal class="mr-2 size-4" />
								{t('generalSettings.addToPath')}
							</Button>
						</div>
					</Tooltip.Trigger>
					<Tooltip.Content side="top" align="center">
						<p>{t('generalSettings.appImageIntegrationDescription')}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Card.Content>
		</Card.Root>
	{/if}

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

<!-- PATH Success Dialog -->
<Dialog.Root bind:open={showPathSuccessDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{t('generalSettings.pathSuccessTitle')}</Dialog.Title>
			<Dialog.Description class="space-y-4 pt-2 text-foreground">
				<p class="font-bold">
					{t('generalSettings.pathSuccessMessage')}
				</p>
				
				<div class="space-y-2">
					<p>{t('generalSettings.pathSuccessRunNow')}</p>
					<div class="relative group">
						<code class="block rounded bg-muted p-3 pr-12 font-mono text-sm border">
							tauri-app-template
						</code>
						<Button 
							variant="ghost" 
							size="icon" 
							class="absolute right-1.5 top-1.5 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
							onclick={copyCommand}
						>
							{#if copied}
								<Check class="size-4 text-green-500" />
							{:else}
								<Copy class="size-4" />
							{/if}
						</Button>
					</div>
				</div>

				<p class="text-muted-foreground text-sm">
					<strong>{t('common.note')}:</strong> {t('generalSettings.pathSuccessNote')}
				</p>
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button class="w-full" onclick={() => (showPathSuccessDialog = false)}>{t('common.done')}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
