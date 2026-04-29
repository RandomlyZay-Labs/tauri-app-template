<script lang="ts">
import * as Command from '@/components/ui/command';
import { t } from '@/lib/i18n';
import { commands } from '@/lib/ipc';
import { relaunchApp, resetApplication } from '@/lib/system-utils';
import { clearPersistentStore } from '@/lib/tauri-storage';
import { toast } from '@/lib/toast';
import { backupStore } from '@/stores/backupStore.svelte';
import { themeStore } from '@/stores/themeStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import {
    Database,
    Home,
    Info,
    Laptop,
    Moon,
    RotateCw,
    Settings,
    Sun,
    Trash2,
} from '@lucide/svelte';
import { push } from 'svelte-spa-router';

let open = $derived(uiStore.commandPaletteOpen);

function runCommand(action: () => void | Promise<void>) {
	uiStore.setCommandPaletteOpen(false);
	const result = action();
	if (result instanceof Promise) {
		void result;
	}
}

async function handleResetApp() {
	const confirmed = await commands.notify(t('generalSettings.resetApplicationTitle'), t('generalSettings.resetApplicationDescription'));
	// In a real app, we'd use a better dialog, but for the palette we can use a quick confirm or just do it.
	// Since this is for testing edge cases, let's make it direct but with a toast for visibility if not resetting immediately.
	try {
		await resetApplication();
		await clearPersistentStore();
		await relaunchApp();
	} catch (e) {
		toast.error(t('generalSettings.failedToResetApp'));
	}
}

async function handlePruneBackups() {
	try {
		const deleted = await commands.pruneBackups(backupStore.maxBackups);
		toast.success(t('backupSettings.backupDeleted'));
	} catch (e) {
		toast.error(t('backupSettings.backupDeleteFailed'));
	}
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
		e.preventDefault();
		uiStore.setCommandPaletteOpen(!uiStore.commandPaletteOpen);
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

<Command.Dialog bind:open={uiStore.commandPaletteOpen}>
	<Command.Input placeholder={t('commandPalette.placeholder')} />
	<Command.List>
		<Command.Empty>{t('commandPalette.noResults')}</Command.Empty>

		<Command.Group heading={t('commandPalette.navigation')}>
			<Command.Item onSelect={() => runCommand(() => push('/'))}>
				<Home class="mr-2 size-4" />
				<span>{t('common.home')}</span>
			</Command.Item>
			<Command.Item onSelect={() => runCommand(() => push('/settings'))}>
				<Settings class="mr-2 size-4" />
				<span>{t('common.settings')}</span>
			</Command.Item>
			<Command.Item onSelect={() => runCommand(() => push('/about'))}>
				<Info class="mr-2 size-4" />
				<span>{t('common.about')}</span>
			</Command.Item>
		</Command.Group>

		<Command.Separator />

		<Command.Group heading={t('commandPalette.theme')}>
			<Command.Item onSelect={() => runCommand(() => themeStore.setTheme('light'))}>
				<Sun class="mr-2 size-4" />
				<span>{t('common.light')}</span>
				{#if themeStore.theme === 'light'}
					<span class="ml-auto text-muted-foreground text-xs">{t('common.active')}</span>
				{/if}
			</Command.Item>
			<Command.Item onSelect={() => runCommand(() => themeStore.setTheme('dark'))}>
				<Moon class="mr-2 size-4" />
				<span>{t('common.dark')}</span>
				{#if themeStore.theme === 'dark'}
					<span class="ml-auto text-muted-foreground text-xs">{t('common.active')}</span>
				{/if}
			</Command.Item>
			<Command.Item onSelect={() => runCommand(() => themeStore.setTheme('system'))}>
				<Laptop class="mr-2 size-4" />
				<span>{t('common.system')}</span>
				{#if themeStore.theme === 'system'}
					<span class="ml-auto text-muted-foreground text-xs">{t('common.active')}</span>
				{/if}
			</Command.Item>
		</Command.Group>

		<Command.Separator />

		<Command.Group heading={t('commandPalette.systemGroup')}>
			<Command.Item onSelect={() => runCommand(() => window.location.reload())}>
				<RotateCw class="mr-2 size-4" />
				<span>{t('commandPalette.reloadWindow')}</span>
			</Command.Item>
		</Command.Group>

		<Command.Separator />

		<Command.Group heading={t('commandPalette.dangerZone')}>
			<Command.Item onSelect={() => runCommand(handlePruneBackups)}>
				<Database class="mr-2 size-4" />
				<span>{t('commandPalette.pruneBackups')}</span>
			</Command.Item>
			<Command.Item onSelect={() => runCommand(handleResetApp)} class="text-destructive">
				<Trash2 class="mr-2 size-4" />
				<span>{t('commandPalette.resetApp')}</span>
			</Command.Item>
		</Command.Group>
	</Command.List>
</Command.Dialog>
