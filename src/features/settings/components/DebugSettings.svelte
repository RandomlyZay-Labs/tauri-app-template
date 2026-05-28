<script lang="ts">
import { Button } from '@/components/ui/button';
import * as Card from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import * as Tooltip from '@/components/ui/tooltip';
import { executeSafeAction } from '@/lib/async-utils';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { commands } from '@/lib/ipc';
import {
    exitApp,
    relaunchApp,
    showConfirmDialog,
    triggerNotification,
} from '@/lib/system-utils';
import { toast } from '@/lib/toast';
import { trayStore } from '@/stores/trayStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import {
    Bell,
    Download,
    Info,
    MessageSquare,
    Power,
    RefreshCw,
    RotateCcw,
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

function handleTestNotification() {
	void executeSafeAction(
		() =>
			triggerNotification(
				t('debugSettings.testNotificationTitle'),
				t('debugSettings.testNotificationBody'),
			),
		{
			successMessage: t('debugSettings.systemNotificationSent'),
			errorMessage: t('debugSettings.failedToSendNotification'),
		},
	);
}

function handleTestNativeDialog() {
	void executeSafeAction(
		async () => {
			const confirmed = await showConfirmDialog(
				t('debugSettings.nativeDialogMessage'),
				t('debugSettings.nativeDialogTitle'),
			);
			toast.info(
				t('debugSettings.nativeDialogResult', {
					result: confirmed
						? t('debugSettings.resultYes')
						: t('debugSettings.resultNo'),
				}),
			);
		},
		{ errorMessage: t('debugSettings.failedToOpenDialog') },
	);
}

function handleRelaunch() {
	void executeSafeAction(() => relaunchApp(), {
		errorMessage: t('debugSettings.failedToRelaunch'),
	});
}

function handleExit() {
	void executeSafeAction(() => exitApp(), {
		errorMessage: t('debugSettings.failedToExit'),
	});
}

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
</script>

<div class="space-y-6">
	<Card.Root>
		<Card.Header>
			<Card.Title>{t('debugSettings.title')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-6">
			<!-- Minimize to Tray -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<span
										{...props}
										class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
									>
										{t('debugSettings.minimizeToTray')}
										<Info class="size-3.5 text-muted-foreground/70" />
									</span>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="top" align="center">
								<p>{t('debugSettings.minimizeToTrayDescription')}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</div>
					<div class="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							class={cn('size-8 text-muted-foreground', {
								invisible: !trayStore.minimizeToTray,
							})}
							onclick={() => trayStore.setMinimizeToTray(false)}
							title={t('common.reset')}
							aria-hidden={!trayStore.minimizeToTray}
							tabindex={!trayStore.minimizeToTray ? -1 : 0}
						>
							<RotateCcw class="size-4" />
						</Button>
						<Switch checked={trayStore.minimizeToTray} onCheckedChange={() => trayStore.setMinimizeToTray(!trayStore.minimizeToTray)} />
					</div>
				</div>

				<div class="ml-6 flex items-center justify-between border-l pl-4">
					<div class="space-y-0.5">
						<Tooltip.Root>
							<Tooltip.Trigger disabled={!trayStore.minimizeToTray}>
								{#snippet child({ props })}
									<span
										{...props}
										class={cn(
											'text-sm font-medium inline-flex items-center gap-1.5 cursor-help',
											{
												'text-muted-foreground': !trayStore.minimizeToTray,
											},
										)}
									>
										{t('debugSettings.notifyWhenMinimized')}
										<Info class="size-3.5 text-muted-foreground/70" />
									</span>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="top" align="center">
								<p>{t('debugSettings.notifyWhenMinimizedDescription')}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</div>
					<div class="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							class={cn('size-8 text-muted-foreground', {
								invisible: trayStore.notifyOnMinimize,
							})}
							onclick={() => trayStore.setNotifyOnMinimize(true)}
							title={t('common.reset')}
							disabled={!trayStore.minimizeToTray}
							aria-hidden={trayStore.notifyOnMinimize}
							tabindex={trayStore.notifyOnMinimize ? -1 : 0}
						>
							<RotateCcw class="size-4" />
						</Button>
						<Switch checked={trayStore.notifyOnMinimize} disabled={!trayStore.minimizeToTray} onCheckedChange={() => trayStore.setNotifyOnMinimize(!trayStore.notifyOnMinimize)} />
					</div>
				</div>
			</div>

			<div class="h-px bg-border"></div>

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

			<!-- Native Features -->
			<div class="flex items-center justify-between border-b pb-4">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<span
									{...props}
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('debugSettings.nativeFeatures')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</span>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('debugSettings.nativeFeaturesDescription')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" onclick={handleTestNotification}>
						<Bell class="mr-2 size-4" />
						{t('debugSettings.notification')}
					</Button>
					<Button variant="outline" onclick={handleTestNativeDialog}>
						<MessageSquare class="mr-2 size-4" />
						{t('debugSettings.nativeDialog')}
					</Button>
				</div>
			</div>

			<!-- Process Control -->
			<div class="flex items-center justify-between border-b pb-4">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<span
									{...props}
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('debugSettings.processControl')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</span>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('debugSettings.processControlDescription')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" onclick={handleRelaunch}>
						<RefreshCw class="mr-2 size-4" />
						{t('debugSettings.relaunch')}
					</Button>
					<Button variant="outline" onclick={handleExit}>
						<Power class="mr-2 size-4" />
						{t('debugSettings.exit')}
					</Button>
				</div>
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
