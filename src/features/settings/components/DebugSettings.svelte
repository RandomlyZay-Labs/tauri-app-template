<script lang="ts">
import { commands } from '@/lib/ipc';
import * as Tooltip from '@/components/ui/tooltip';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
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
    MessageSquare,
    Power,
    RefreshCw,
    RotateCcw,
} from '@lucide/svelte';
import { Button } from '@/components/ui/button';
import * as Card from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

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
				<Tooltip.Root>
					<Tooltip.Trigger class="w-full text-left">
						<div class="flex items-center justify-between">
							<div class="space-y-0.5">
								<span class="text-base font-medium block">{t('debugSettings.minimizeToTray')}</span>
							</div>
							<div class="flex items-center gap-2">
								<Button
									variant="ghost"
									size="icon"
									class="size-8 text-muted-foreground {!trayStore.minimizeToTray ? 'invisible' : ''}"
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
					</Tooltip.Trigger>
					<Tooltip.Content side="top" align="center">
						<p>{t('debugSettings.minimizeToTrayDescription')}</p>
					</Tooltip.Content>
				</Tooltip.Root>

				<Tooltip.Root>
					<Tooltip.Trigger class="w-full text-left" disabled={!trayStore.minimizeToTray}>
						<div class="ml-6 flex items-center justify-between border-l pl-4">
							<div class="space-y-0.5">
								<span class="text-base font-medium block {!trayStore.minimizeToTray ? 'text-muted-foreground' : ''}">{t('debugSettings.notifyWhenMinimized')}</span>
							</div>
							<div class="flex items-center gap-2">
								<Button
									variant="ghost"
									size="icon"
									class="size-8 text-muted-foreground {trayStore.notifyOnMinimize ? 'invisible' : ''}"
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
					</Tooltip.Trigger>
					<Tooltip.Content side="top" align="center">
						<p>{t('debugSettings.notifyWhenMinimizedDescription')}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</div>

			<div class="h-px bg-border"></div>

			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between border-b pb-4">
						<div class="space-y-0.5">
							<span class="text-base font-medium block">{t('debugSettings.developerTools')}</span>
						</div>
						<div class="flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon"
								class="size-8 text-muted-foreground {!uiStore.contextMenuEnabled ? 'invisible' : ''}"
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
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('debugSettings.developerToolsDescription')}</p>
				</Tooltip.Content>
			</Tooltip.Root>

			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between border-b pb-4">
						<div class="space-y-0.5">
							<span class="text-base font-medium block">{t('debugSettings.debugMode')}</span>
						</div>
						<div class="flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon"
								class="size-8 text-muted-foreground {!debugOn ? 'invisible' : ''}"
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
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('debugSettings.debugModeDescription')}</p>
				</Tooltip.Content>
			</Tooltip.Root>

			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between border-b pb-4">
						<div class="space-y-0.5">
							<span class="text-base font-medium block">{t('debugSettings.nativeFeatures')}</span>
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
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('debugSettings.nativeFeaturesDescription')}</p>
				</Tooltip.Content>
			</Tooltip.Root>

			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between border-b pb-4">
						<div class="space-y-0.5">
							<span class="text-base font-medium block">{t('debugSettings.processControl')}</span>
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
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('debugSettings.processControlDescription')}</p>
				</Tooltip.Content>
			</Tooltip.Root>

			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between border-b pb-4">
						<div class="space-y-0.5">
							<span class="text-base font-medium block">{t('debugSettings.exportDiagnostics')}</span>
						</div>
						<Button variant="outline" onclick={handleExportLogs}>
							<Download class="mr-2 size-4" />
							{t('debugSettings.exportLogs')}
						</Button>
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('debugSettings.exportDiagnosticsDescription')}</p>
				</Tooltip.Content>
			</Tooltip.Root>

			<Tooltip.Root>
				<Tooltip.Trigger class="w-full text-left">
					<div class="flex items-center justify-between">
						<div class="space-y-0.5">
							<span class="text-base font-medium block">{t('debugSettings.crashTest')}</span>
						</div>
						<Button variant="destructive" onclick={() => (shouldCrash = true)}>
							{t('debugSettings.triggerError')}
						</Button>
					</div>
				</Tooltip.Trigger>
				<Tooltip.Content side="top" align="center">
					<p>{t('debugSettings.crashTestDescription')}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Card.Content>
	</Card.Root>
</div>
