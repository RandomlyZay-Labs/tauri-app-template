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
import {
    Database,
    FolderOpen,
    Info,
    Rocket,
    RotateCcw,
    Trash2,
} from '@lucide/svelte';
import { onMount } from 'svelte';
import { push } from 'svelte-spa-router';

import { Button } from '@/components/ui/button';
import * as Card from '@/components/ui/card';
import * as Dialog from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

let showResetDialog = $state(false);
let showPrefResetDialog = $state(false);
let deleteConfirmation = $state('');

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
</script>

<div class="space-y-6">

	<Card.Root>
		<Card.Header>
			<Card.Title>{t('generalSettings.storageLogs')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-6">
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<label
									{...props}
									for="storage-data-btn"
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('generalSettings.applicationData')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</label>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('generalSettings.openDataFolder')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<Button id="storage-data-btn" variant="outline" onclick={handleOpenData}>
					<Database class="mr-2 size-4" />
					{t('generalSettings.openData')}
				</Button>
			</div>

			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<label
									{...props}
									for="storage-logs-btn"
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('generalSettings.systemLogs')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</label>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('generalSettings.viewLogs')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<Button id="storage-logs-btn" variant="outline" onclick={handleOpenLogs}>
					<FolderOpen class="mr-2 size-4" />
					{t('generalSettings.openLogs')}
				</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{t('generalSettings.telemetry')}</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<label
									{...props}
									for="telemetry-switch"
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('generalSettings.enableTelemetry')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</label>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('generalSettings.telemetryDescription')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<Switch id="telemetry-switch" checked={uiStore.telemetryEnabled} onCheckedChange={handleTelemetryToggle} />
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{t('generalSettings.onboarding')}</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<label
									{...props}
									for="rerun-onboarding-btn"
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('generalSettings.rerunOnboarding')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</label>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('generalSettings.onboardingDescription')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<Button id="rerun-onboarding-btn" variant="outline" onclick={handleRerunOnboarding}>
					<Rocket class="mr-2 size-4" />
					{t('generalSettings.rerunOnboarding')}
				</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{t('generalSettings.resetDangerZone')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<label
									{...props}
									for="reset-prefs-btn"
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('generalSettings.resetPreferences')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</label>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('generalSettings.restoreDefaultSettings')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<Button id="reset-prefs-btn" variant="outline" onclick={() => (showPrefResetDialog = true)}>
					<RotateCcw class="mr-2 size-4" />
					{t('generalSettings.resetDefaults')}
				</Button>
			</div>

			<div class="h-px bg-border"></div>

			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<label
									{...props}
									for="clear-data-btn"
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help text-destructive"
								>
									{t('generalSettings.clearAllData')}
									<Info class="size-3.5 text-destructive/70" />
								</label>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('generalSettings.clearAllDataDescription')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<Button id="clear-data-btn" variant="outline" class="border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive" onclick={() => { deleteConfirmation = ''; showResetDialog = true; }}>
					<Trash2 class="mr-2 size-4" />
					{t('generalSettings.resetApplication')}
				</Button>
			</div>
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


