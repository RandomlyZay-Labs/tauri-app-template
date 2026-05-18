<script lang="ts">
import { Button } from '@/components/ui/button';
import * as Card from '@/components/ui/card';
import * as Tooltip from '@/components/ui/tooltip';
import { getAppVersion } from '@/lib/app-version.svelte';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { getCliStatus, installCli } from '@/lib/system-utils';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, CheckCircle2, Copy, Download, RefreshCw, Terminal } from '@lucide/svelte';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { onMount } from 'svelte';

let cliStatus = $state<{ installed: boolean; version: string | null } | null>(null);
let isLoading = $state(false);
let copied = $state(false);
const appVersion = $derived(getAppVersion());
const commandText = 'tauri-app-template-cli --help';

async function refreshStatus() {
    cliStatus = await getCliStatus();
}

onMount(() => {
    void refreshStatus();
});

async function handleCopy() {
    await writeText(commandText);
    copied = true;
    setTimeout(() => (copied = false), 2000);
}

async function handleInstallOrUpdate() {
    isLoading = true;
    try {
        await executeSafeAction(
            async () => {
                await installCli();
                await refreshStatus();
                toast.success(t('cliSettings.installSuccess'));
            },
            { 
                errorMessage: t('cliSettings.installFailed')
            }
        );
    } finally {
        isLoading = false;
    }
}

const isUpToDate = $derived(cliStatus?.installed && cliStatus.version === appVersion);
const needsUpdate = $derived(cliStatus?.installed && cliStatus.version !== appVersion);
</script>

<div class="space-y-6">
    <Card.Root>
        <Card.Header>
            <Card.Title>{t('cliSettings.title')}</Card.Title>
            <Card.Description>{t('cliSettings.description')}</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
            <div class="flex items-center justify-between border-b pb-4">
                <div class="space-y-1">
                    <p class="text-sm font-medium leading-none">{t('cliSettings.status')}</p>
                    <p class="text-muted-foreground text-xs">
                        {#if cliStatus === null}
                            {t('common.loading')}...
                        {:else if !cliStatus.installed}
                            <span class="text-destructive flex items-center gap-1">
                                <AlertCircle class="size-3" />
                                {t('cliSettings.notInstalled')}
                            </span>
                        {:else if isUpToDate}
                            <span class="text-green-500 flex items-center gap-1">
                                <CheckCircle2 class="size-3" />
                                {t('cliSettings.upToDate')} (v{cliStatus.version})
                            </span>
                        {:else}
                            <span class="text-amber-500 flex items-center gap-1">
                                <RefreshCw class="size-3 animate-spin-slow" />
                                {t('cliSettings.versionMismatch')} (v{cliStatus.version} vs v{appVersion})
                            </span>
                        {/if}
                    </p>
                </div>
                
                <Button 
                    variant={needsUpdate ? "default" : "outline"} 
                    disabled={isLoading || isUpToDate || cliStatus === null}
                    onclick={handleInstallOrUpdate}
                >
                    {#if isLoading}
                        <RefreshCw class="mr-2 size-4 animate-spin" />
                        {t('common.loading')}...
                    {:else if needsUpdate}
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
            </div>

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
                                            "size-7 transition-all duration-200",
                                            copied ? "border-green-500/50 bg-green-500/10 text-green-600" : "hover:bg-background"
                                        )}
                                        onclick={handleCopy}
                                    >
                                        {#if copied}
                                            <Check class="size-3.5 transition-all animate-in zoom-in" />
                                        {:else}
                                            <Copy class="size-3.5 transition-all" />
                                        {/if}
                                    </Button>
                                {/snippet}
                            </Tooltip.Trigger>
                            <Tooltip.Content side="top" class="px-2 py-1 text-[10px]">
                                <p>{copied ? t('common.copied') : t('common.copy')}</p>
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

<style>
    :global(.animate-spin-slow) {
        animation: spin 3s linear infinite;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
