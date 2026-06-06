<script lang="ts">
import AppLayout from '@/components/layout/AppLayout.svelte';
import * as Tabs from '@/components/ui/tabs';
import * as Tooltip from '@/components/ui/tooltip';
import { t } from '@/lib/i18n';
import { animationStore } from '@/stores/animationStore.svelte';
import { uiStore, validateSettingsTab, type SettingsTab } from '@/stores/uiStore.svelte';
import { updateStore } from '@/stores/updateStore.svelte';
import { quintOut } from 'svelte/easing';
import { crossfade } from 'svelte/transition';
import { untrack } from 'svelte';
import AppearanceSettings from './components/AppearanceSettings.svelte';
import BackupSettings from './components/BackupSettings.svelte';
import UpdateSettings from './components/UpdateSettings.svelte';
import DebugSettings from './components/DebugSettings.svelte';
import GeneralSettings from './components/GeneralSettings.svelte';

import { Bug, HardDrive, Palette, Settings2, Download } from '@lucide/svelte';

const tabs = [
	{ id: 'general', labelKey: 'settings.general', icon: Settings2 },
	{ id: 'appearance', labelKey: 'settings.appearance', icon: Palette },
	{ id: 'backups', labelKey: 'settings.backups', icon: HardDrive },
	{ id: 'debug', labelKey: 'settings.debug', icon: Bug },
	{ id: 'updates', labelKey: 'settings.updates', icon: Download },
];

const [send, receive] = crossfade({
	easing: quintOut,
});

let activeTab = $state<SettingsTab>(validateSettingsTab(uiStore?.activeSettingsTab));

$effect(() => {
	if (uiStore?.activeSettingsTab && uiStore.activeSettingsTab !== untrack(() => activeTab)) {
		activeTab = validateSettingsTab(uiStore.activeSettingsTab);
	}
});

$effect(() => {
	if (uiStore && untrack(() => uiStore.activeSettingsTab) !== activeTab) {
		uiStore.setActiveSettingsTab(validateSettingsTab(activeTab));
	}
});

$effect(() => {
	if (activeTab === 'updates') {
		updateStore.hasUnseenUpdate = false;
	}
});
</script>

<AppLayout>
	<Tooltip.Provider delayDuration={300}>
		<div class="space-y-6">
			<div>
				<h1 class="font-bold text-3xl tracking-tight">{t('settings.title')}</h1>
				<p class="text-muted-foreground">{t('settings.description')}</p>
			</div>

			<Tabs.Root bind:value={activeTab}>
				<Tabs.List class="relative flex w-full justify-start rounded-none border-b bg-transparent p-0">
					{#each tabs as tab (tab.id)}
						<Tabs.Trigger
							value={tab.id}
							data-testid={`tab-trigger-${tab.id}`}
							class="relative h-10 rounded-lg bg-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-all duration-200 hover:bg-muted/50 hover:text-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
						>
							<span class="flex items-center gap-2">
								<tab.icon class="size-4" />
								{t(tab.labelKey)}
							</span>
							{#if activeTab === tab.id}
								<div
									class="absolute -bottom-px left-1 right-1 z-10 h-0.5 rounded-full bg-primary"
									in:send={{ key: 'active-tab', duration: animationStore.animationsEnabled ? 250 : 0 }}
									out:receive={{ key: 'active-tab', duration: animationStore.animationsEnabled ? 250 : 0 }}
								></div>
							{/if}
						</Tabs.Trigger>
					{/each}
				</Tabs.List>

				<Tabs.Content value="general" class="mt-6">
					<GeneralSettings />
				</Tabs.Content>
				<Tabs.Content value="appearance" class="mt-6">
					<AppearanceSettings />
				</Tabs.Content>
				<Tabs.Content value="backups" class="mt-6">
					<BackupSettings />
				</Tabs.Content>
				<Tabs.Content value="debug" class="mt-6">
					<DebugSettings />
				</Tabs.Content>
				<Tabs.Content value="updates" class="mt-6">
					<UpdateSettings />
				</Tabs.Content>
			</Tabs.Root>
		</div>
	</Tooltip.Provider>
</AppLayout>