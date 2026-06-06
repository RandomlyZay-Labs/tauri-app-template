<script lang="ts">
import { Button } from '@/components/ui/button';
import * as Card from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import * as Tooltip from '@/components/ui/tooltip';
import { executeSafeAction } from '@/lib/async-utils';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { commands } from '@/lib/ipc';
import { toast } from '@/lib/toast';
import { uiStore } from '@/stores/uiStore.svelte';
import {
    openDataDirectory,
    openLogDirectory,
} from '@/lib/system-utils';
import {
    Download,
    Info,
    RotateCcw,
    Database,
    FolderOpen,
} from '@lucide/svelte';

let shouldCrash = $state(false);
let debugOn = $derived(
	uiStore.logLevel === 'debug' || uiStore.logLevel === 'trace',
);

$effect(() => {
	if (shouldCrash) {
		throw new Error('This is a simulated crash to test the Error Boundary.');
	}
});

function handleExportLogs() {
	void executeSafeAction(
		async () => {
			const saved = await commands.exportDiagnostics();
			if (saved) {
				toast.success(t('debugSettings.exportLogsSuccess'));
			}
		},
		{
			errorMessage: t('debugSettings.exportLogsFailed'),
		},
	);
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
</script>

<div class="space-y-6">
	<Card.Root>
		<Card.Header>
			<Card.Title>{t('debugSettings.title')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-6">


			<!-- Developer Tools -->
			<div class="flex items-center justify-between border-b pb-4">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<span
									{...props}
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('debugSettings.developerTools')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</span>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('debugSettings.developerToolsDescription')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<div class="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						class={cn('size-8 text-muted-foreground', {
							invisible: !uiStore.contextMenuEnabled,
						})}
						onclick={() => uiStore.setContextMenuEnabled(false)}
						title={t('common.reset')}
						aria-hidden={!uiStore.contextMenuEnabled}
						tabindex={!uiStore.contextMenuEnabled ? -1 : 0}
					>
						<RotateCcw class="size-4" />
					</Button>
					<Switch checked={uiStore.contextMenuEnabled} onCheckedChange={() => uiStore.setContextMenuEnabled(!uiStore.contextMenuEnabled)} />
				</div>
			</div>

			<!-- Debug Mode -->
			<div class="flex items-center justify-between border-b pb-4">
				<div>
					<div class="hidden">Debug Mode</div>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<div
									{...props}
									class="space-y-0.5 cursor-help"
								>
									<span class="text-sm font-medium inline-flex items-center gap-1.5">
										{t('debugSettings.debugMode')}
										<Info class="size-3.5 text-muted-foreground/70" />
									</span>
								</div>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('debugSettings.debugModeDescription')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<div class="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						class={cn('size-8 text-muted-foreground', {
							invisible: !debugOn,
						})}
						onclick={() => uiStore.setLogLevel('info')}
						title={t('common.reset')}
						aria-hidden={!debugOn}
						tabindex={!debugOn ? -1 : 0}
					>
						<RotateCcw class="size-4" />
					</Button>
					<Switch checked={debugOn} onCheckedChange={() => uiStore.setLogLevel(debugOn ? 'info' : 'debug')} />
				</div>
			</div>

			<!-- Storage & Logs -->
			<div class="flex items-center justify-between border-b pb-4">
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

			<div class="flex items-center justify-between border-b pb-4">
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

			<!-- Export Diagnostics -->
			<div class="flex items-center justify-between border-b pb-4">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<span
									{...props}
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('debugSettings.exportDiagnostics')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</span>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('debugSettings.exportDiagnosticsDescription')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<Button variant="outline" onclick={handleExportLogs}>
					<Download class="mr-2 size-4" />
					{t('debugSettings.exportLogs')}
				</Button>
			</div>

			<!-- Crash Test -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<span
									{...props}
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('debugSettings.crashTest')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</span>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('debugSettings.crashTestDescription')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<Button variant="destructive" onclick={() => (shouldCrash = true)}>
					{t('debugSettings.triggerError')}
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
</div>
