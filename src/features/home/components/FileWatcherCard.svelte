<script lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { commands } from '@/lib/ipc';
import { logger } from '@/lib/logger';
import { watcherStore } from '@/stores/watcherStore.svelte';
import { Eye, EyeOff, FileSearch } from '@lucide/svelte';
import { open } from '@tauri-apps/plugin-dialog';

import * as Card from '@/components/ui/card';

let watchInput = $state('');

async function handleBrowseFile() {
	const selected = await open({ directory: false, multiple: false });
	if (typeof selected === 'string') watchInput = selected;
}

async function handleBrowseFolder() {
	const selected = await open({ directory: true, multiple: false });
	if (typeof selected === 'string') watchInput = selected;
}

function handleWatch() {
	const p = watchInput.trim();
	if (!p) return;
	void logger.debug('[FileWatcherCard] user initiated watchPath', { path: p });
	void executeSafeAction(
		async () => {
			await commands.watchPath(p);
			watcherStore.addPath(p);
			watchInput = '';
		},
		{
			successMessage: t('debugSettings.pathWatched', { path: p }),
			errorMessage: t('debugSettings.failedToWatch'),
		},
	);
}

function handleUnwatch(p: string) {
	void logger.debug('[FileWatcherCard] user initiated unwatchPath', {
		path: p,
	});
	void executeSafeAction(
		async () => {
			await commands.unwatchPath(p);
			watcherStore.removePath(p);
		},
		{
			successMessage: t('debugSettings.pathUnwatched', { path: p }),
			errorMessage: t('debugSettings.failedToUnwatch'),
		},
	);
}
</script>

<Card.Root class="card-hover-glow overflow-hidden border-t-2 border-t-emerald-500/50">
	<Card.Header>
		<Card.Title class="flex items-center gap-3 text-2xl">
			<div class="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
				<Eye class="size-5 text-emerald-500" />
			</div>
			{t('debugSettings.fileWatcher')}
		</Card.Title>
		<Card.Description>{t('debugSettings.fileWatcherDescription')}</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-4">
		<div class="flex gap-2">
			<Input
				readonly
				placeholder={t('debugSettings.watchPathPlaceholder')}
				value={watchInput}
			/>
			<Button
				variant="outline"
				onclick={() => void handleBrowseFile()}
			>
				<FileSearch class="mr-1.5 size-4" />
				{t('debugSettings.browseFile')}
			</Button>
			<Button
				variant="outline"
				onclick={() => void handleBrowseFolder()}
			>
				<FileSearch class="mr-1.5 size-4" />
				{t('debugSettings.browseFolder')}
			</Button>
		</div>

		<Button
			class="w-full"
			onclick={handleWatch}
			disabled={!watchInput.trim()}
		>
			<Eye class="mr-2 size-4" />
			{t('debugSettings.watch')}
		</Button>

		{#if watcherStore.watchedPaths.length === 0}
			<p class="text-muted-foreground text-sm">{t('debugSettings.noWatchedPaths')}</p>
		{:else}
			<div class="space-y-2">
				{#each watcherStore.watchedPaths as p (p)}
					<div class="flex items-center justify-between rounded-md border px-3 py-2">
						<span class="truncate font-mono text-sm">{p}</span>
						<Button
							variant="ghost"
							size="icon"
							class="size-8"
							onclick={() => handleUnwatch(p)}
							aria-label={t('debugSettings.unwatch')}
						>
							<EyeOff class="size-4" />
						</Button>
					</div>
				{/each}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
