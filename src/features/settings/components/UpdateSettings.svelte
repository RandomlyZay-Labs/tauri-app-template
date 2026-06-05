<script lang="ts">
import { Button } from '@/components/ui/button';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import * as Card from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import * as Tooltip from '@/components/ui/tooltip';
import * as Dialog from '@/components/ui/dialog';
import { getAppVersion } from '@/lib/app-version.svelte';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { getCliStatus, installCli, openExternalLink } from '@/lib/system-utils';
import { cn } from '@/lib/utils';
import { uiStore } from '@/stores/uiStore.svelte';
import { updateStore } from '@/stores/updateStore.svelte';
import { networkStore } from '@/stores/networkStore.svelte';
import {
	AlertCircle,
	Check,
	CheckCircle2,
	Copy,
	Download,
	Info,
	RefreshCw,
	RotateCcw,
	Terminal,
	Globe,
	Languages,
} from '@lucide/svelte';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { onMount } from 'svelte';
import { slide } from 'svelte/transition';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

let cliStatus = $state<{ installed: boolean; version: string | null } | null>(null);
let isCliLoading = $state(false);
let cliCopied = $state(false);
let packageCommandCopied = $state(false);
let relaunchDialogOpen = $state(false);

const appVersion = $derived(getAppVersion());
const commandText = 'tauri-app-template-cli --help';
const defaultAutoCheck = true;

function formatUpdateDate(dateString: string | undefined): string | null {
	if (!dateString) return null;
	try {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) {
			return dateString;
		}
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	} catch {
		return dateString;
	}
}

let translatedText = $state<string | null>(null);
let isTranslating = $state(false);
let showTranslated = $state(false);
let githubChangelog = $state<string | null>(null);
let isFetchingChangelog = $state(false);

const isNotEnglish = $derived(
	typeof navigator !== 'undefined' &&
	navigator.language?.split('-')[0] !== 'en'
);

const targetLang = $derived(
	typeof navigator !== 'undefined'
		? navigator.language?.split('-')[0] || 'en'
		: 'en'
);

async function fetchGithubChangelog(version: string) {
	isFetchingChangelog = true;
	githubChangelog = null;
	await executeSafeAction(
		async () => {
			const response = await fetch(
				`https://api.github.com/repos/RandomlyZay-Labs/tauri-app-template/releases/tags/v${version}`,
				{ headers: { Accept: 'application/vnd.github+json' } }
			);
			if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
			const data = await response.json() as { body?: string };
			githubChangelog = data.body ?? null;
		},
		{ silent: true }
	);
	isFetchingChangelog = false;
}

$effect(() => {
	// Reset translation state and fetch the changelog whenever the available version changes
	if (updateStore.version) {
		translatedText = null;
		showTranslated = false;
		void fetchGithubChangelog(updateStore.version);
	} else {
		githubChangelog = null;
	}
});

async function handleTranslateToggle() {
	if (showTranslated) {
		showTranslated = false;
		return;
	}

	if (translatedText) {
		showTranslated = true;
		return;
	}

	const changelogText = githubChangelog;
	if (!changelogText) return;

	isTranslating = true;
	await executeSafeAction(
		async () => {
			const translated = await translateText(changelogText, targetLang);
			translatedText = translated;
			showTranslated = true;
		},
		{
			errorMessage: t('errors.unexpectedError'),
			onError: (err) => console.error('Translation failed:', err)
		}
	);
	isTranslating = false;
}

async function translateText(text: string, lang: string): Promise<string> {
	const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Translation request failed: ${response.status}`);
	}
	const data = await response.json();
	if (Array.isArray(data) && Array.isArray(data[0])) {
		return data[0].map((segment) => {
			if (Array.isArray(segment) && typeof segment[0] === 'string') {
				return segment[0];
			}
			return '';
		}).join('');
	}
	throw new Error('Invalid translation response format');
}

const parsedMarkdown = $derived.by(() => {
	const raw = showTranslated && translatedText ? translatedText : (githubChangelog || '');
	const html = marked.parse(raw) as string;
	return DOMPurify.sanitize(html);
});

function linkInterceptor(node: HTMLElement) {
	const handleLinkClick = (event: MouseEvent) => {
		const target = event.target as HTMLElement;
		const anchor = target.closest('a');
		if (anchor) {
			const href = anchor.getAttribute('href');
			if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
				event.preventDefault();
				void executeSafeAction(() => openExternalLink(href));
			}
		}
	};

	node.addEventListener('click', handleLinkClick);

	return {
		destroy() {
			node.removeEventListener('click', handleLinkClick);
		}
	};
}

async function refreshCliStatus() {
	let status: { installed: boolean; version: string | null } | null = null;
	await executeSafeAction(
		async () => {
			status = await getCliStatus();
		},
		{ silent: true }
	);
	if (status) {
		cliStatus = status;
	}
}

onMount(() => {
	// Dismiss update banner when viewing the Updates tab
	updateStore.hasUnseenUpdate = false;
	void refreshCliStatus();
});

async function handleCliCopy() {
	await executeSafeAction(
		() => writeText(commandText),
		{
			onSuccess: () => {
				cliCopied = true;
				setTimeout(() => (cliCopied = false), 2000);
			}
		}
	);
}

async function handlePackageCommandCopy() {
	const cmd = updateStore.installType === 'deb' ? t('updateSettings.debCommand') : t('updateSettings.rpmCommand');
	await executeSafeAction(
		() => writeText(cmd),
		{
			onSuccess: () => {
				packageCommandCopied = true;
				setTimeout(() => (packageCommandCopied = false), 2000);
			}
		}
	);
}

async function handleInstallOrUpdateCli() {
	isCliLoading = true;
	try {
		await executeSafeAction(
			async () => {
				await installCli();
				await refreshCliStatus();
			},
			{
				successMessage: t('cliSettings.installSuccess'),
				errorMessage: t('cliSettings.installFailed')
			}
		);
	} finally {
		isCliLoading = false;
	}
}

const isCliUpToDate = $derived(!!(cliStatus?.installed && cliStatus.version !== null && cliStatus.version === appVersion));
const cliNeedsUpdate = $derived(!!(cliStatus?.installed && cliStatus.version !== null && cliStatus.version !== appVersion));

// Auto open relaunch dialog
$effect(() => {
	if (updateStore.status === 'downloaded' && updateStore.installTypeInitialized && !updateStore.isPackageManaged) {
		if (updateStore.cliUpdateStatus === 'done' || updateStore.cliUpdateStatus === 'error' || updateStore.cliUpdateStatus === 'idle') {
			relaunchDialogOpen = true;
		}
	}
});
</script>

<div class="space-y-6">
	<!-- SECTION 1: App Update Status & Controls -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{t('updateSettings.title')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-6">
			<!-- Auto check updates toggle -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<label
									{...props}
									for="auto-check-switch"
									class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
								>
									{t('updateSettings.autoCheck')}
									<Info class="size-3.5 text-muted-foreground/70" />
								</label>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="center">
							<p>{t('updateSettings.autoCheckDescription')}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</div>
				<div class="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						class={cn("size-8 text-muted-foreground", { 'invisible': uiStore.autoCheckUpdates === defaultAutoCheck })}
						onclick={() => {
							uiStore.setAutoCheckUpdates(defaultAutoCheck);
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
						}}
					/>
				</div>
			</div>

			<div class="h-px bg-border"></div>

			<!-- Manual check and status -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<span class="text-sm font-medium leading-none">{t('updateSettings.status')}</span>
						<div class="flex items-center gap-2 mt-1">
							{#if networkStore.isOffline}
								<Badge variant="outline" class="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
									<AlertCircle class="size-3 mr-1" />
									{t('updateSettings.statusOffline')}
								</Badge>
							{:else if updateStore.status === 'idle'}
								<Badge variant="secondary">
									{t('updateSettings.statusIdle')}
								</Badge>
							{:else if updateStore.status === 'checking'}
								<Badge variant="outline" class="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
									<RefreshCw class="animate-spin size-3 mr-1" />
									{t('updateSettings.statusChecking')}
								</Badge>
							{:else if updateStore.status === 'available'}
								<Badge variant="outline" class="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
									<Info class="size-3 mr-1" />
									{t('updateSettings.statusAvailable', { version: updateStore.version })}
								</Badge>
							{:else if updateStore.status === 'no-update'}
								<Badge variant="outline" class="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
									<CheckCircle2 class="size-3 mr-1" />
									{t('updateSettings.statusNoUpdate')}
								</Badge>
							{:else if updateStore.status === 'downloading'}
								<Badge variant="outline" class="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
									<RefreshCw class="animate-spin size-3 mr-1" />
									{t('updateSettings.statusDownloading', { progress: updateStore.percentage })}
								</Badge>
							{:else if updateStore.status === 'downloaded'}
								<Badge variant="outline" class="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
									<CheckCircle2 class="size-3 mr-1" />
									{t('updateSettings.statusDownloaded')}
								</Badge>
							{:else if updateStore.status === 'error'}
								<Badge variant="destructive">
									<AlertCircle class="size-3 mr-1" />
									{t('updateSettings.statusError')}
								</Badge>
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

				<!-- Update detailed info & Actions (uses transition:slide and gates on activeUpdate) -->
				{#if updateStore.activeUpdate}
					<div transition:slide={{ duration: 200 }} class="mt-4 p-4 rounded-lg border bg-card text-card-foreground space-y-4">
						<div class="space-y-1">
							<h4 class="text-sm font-semibold">{t('updateSettings.updateAvailableTitle')}</h4>
							{#if updateStore.date}
								<p class="text-xs text-muted-foreground">
									{t('updateSettings.releasedOn', { date: formatUpdateDate(updateStore.date) })}
								</p>
							{/if}
						</div>

						{#if githubChangelog !== null || isFetchingChangelog}
							<div class="space-y-2">
								<div class="flex items-center justify-between text-xs font-semibold text-muted-foreground">
									<span>{t('updateSettings.changelog')}</span>
									{#if isNotEnglish && githubChangelog}
										<Button 
											variant="ghost" 
											size="xs" 
											class="h-7 text-[10px] gap-1 hover:bg-secondary px-2" 
											onclick={handleTranslateToggle}
											disabled={isTranslating}
										>
											{#if isTranslating}
												<RefreshCw class="size-3 animate-spin" />
												{t('updateSettings.translating')}
											{:else}
												<Languages class="size-3" />
												{showTranslated ? t('updateSettings.showOriginal') : t('updateSettings.translate')}
											{/if}
										</Button>
									{/if}
								</div>
								{#if isFetchingChangelog}
									<div class="flex items-center gap-2 text-xs text-muted-foreground p-3">
										<RefreshCw class="size-3 animate-spin" />
										<span>{t('common.loading')}...</span>
									</div>
								{:else}
									<div 
										class="text-xs p-3 bg-secondary/30 rounded-lg border changelog-content"
										use:linkInterceptor
									>
										{@html parsedMarkdown}
									</div>
								{/if}
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
								<Progress value={updateStore.percentage} class="h-2 bg-secondary dark:bg-zinc-800 [&>[data-slot=progress-indicator]]:transition-none" />
							</div>
						{/if}

						<!-- CLI updating indicator during unified update -->
						{#if !updateStore.isPackageManaged && updateStore.cliUpdateStatus === 'updating'}
							<div transition:slide={{ duration: 150 }} class="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded bg-secondary/20 border border-border/40">
								<RefreshCw class="animate-spin size-3.5 text-primary" />
								<span>{t('updateSettings.cliUpdating')}</span>
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
									<Button size="sm" variant="ghost" class="h-8 hover:bg-zinc-800 hover:text-zinc-50" onclick={handlePackageCommandCopy}>
										{#if packageCommandCopied}
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
									<Button size="sm" onclick={() => executeSafeAction(() => updateStore.applyUpdate())} disabled={updateStore.cliUpdateStatus === 'updating'}>
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

	<!-- SECTION 2: CLI Integration -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{t('updateSettings.cliSection')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-6">
			<div class="flex items-center justify-between border-b pb-4">
				<div class="space-y-1">
					<p class="text-sm font-medium leading-none">{t('cliSettings.status')}</p>
					<p class="text-muted-foreground text-xs mt-1 flex items-center gap-1.5">
						{#if cliStatus === null}
							{t('common.loading')}...
						{:else if !cliStatus.installed}
							<span class="text-destructive flex items-center gap-1">
								<AlertCircle class="size-3" />
								{t('cliSettings.notInstalled')}
							</span>
						{:else if cliStatus.version === null}
							<span class="text-amber-500 flex items-center gap-1">
								<AlertCircle class="size-3" />
								{t('cliSettings.unknownVersion')}
							</span>
						{:else if isCliUpToDate}
							<span class="text-green-500 flex items-center gap-1">
								<CheckCircle2 class="size-3" />
								{t('cliSettings.upToDate')} ({t('updateSettings.cliCurrentVersion')}: v{cliStatus.version})
							</span>
						{:else}
							<span class="text-amber-500 flex items-center gap-1">
								<RefreshCw class="size-3 animate-spin duration-150 animate-duration-snappy" />
								{t('cliSettings.versionMismatch')} (v{cliStatus.version} vs v{appVersion})
							</span>
						{/if}
					</p>
					{#if (updateStore.installType === 'appimage' || updateStore.installType === 'nsis') && cliStatus?.installed}
						<p class="text-[10px] text-muted-foreground mt-0.5">
							{t('updateSettings.cliManagedByApp')}
						</p>
					{/if}
				</div>

				<!-- Installation / Update Controls -->
				{#if updateStore.isPackageManaged}
					<!-- Package-managed: Independent manual installer/updater -->
					<Button 
						variant={cliNeedsUpdate ? "default" : "outline"} 
						disabled={isCliLoading || isCliUpToDate || cliStatus === null}
						onclick={handleInstallOrUpdateCli}
					>
						{#if isCliLoading}
							<RefreshCw class="mr-2 size-4 animate-spin duration-150 animate-duration-snappy" />
							{t('common.loading')}...
						{:else if cliNeedsUpdate}
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
				{:else}
					<!-- Bundled: Auto-managed, only show Install button if not installed at all -->
					{#if cliStatus && !cliStatus.installed}
						<Button 
							variant="default" 
							disabled={isCliLoading}
							onclick={handleInstallOrUpdateCli}
						>
							{#if isCliLoading}
								<RefreshCw class="mr-2 size-4 animate-spin duration-150 animate-duration-snappy" />
								{t('common.loading')}...
							{:else}
								<Download class="mr-2 size-4" />
								{t('cliSettings.installCli')}
							{/if}
						</Button>
					{:else if cliNeedsUpdate}
						<Button 
							variant="default" 
							disabled={isCliLoading}
							onclick={handleInstallOrUpdateCli}
						>
							{#if isCliLoading}
								<RefreshCw class="mr-2 size-4 animate-spin duration-150 animate-duration-snappy" />
								{t('common.loading')}...
							{:else}
								<RefreshCw class="mr-2 size-4" />
								{t('cliSettings.updateCli')}
							{/if}
						</Button>
					{:else if cliStatus?.installed}
						<Badge variant="outline" class="bg-secondary/50 text-muted-foreground gap-1.5 py-1.5 px-3 rounded-md h-auto">
							<Check class="size-3.5 text-green-500" />
							{t('cliSettings.installed')}
						</Badge>
					{/if}
				{/if}
			</div>

			<!-- CLI usage guidance and notes -->
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
											"size-7 transition-all duration-150 animate-duration-snappy",
											cliCopied ? "border-green-500/50 bg-green-500/10 text-green-600" : "hover:bg-background"
										)}
										onclick={handleCliCopy}
									>
										{#if cliCopied}
											<Check class="size-3.5 transition-all animate-in zoom-in" />
										{:else}
											<Copy class="size-3.5 transition-all" />
										{/if}
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="top" class="px-2 py-1 text-[10px]">
								<p>{cliCopied ? t('common.copied') : t('common.copy')}</p>
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

<style>
.changelog-content :global(h1),
.changelog-content :global(h2),
.changelog-content :global(h3) {
	font-weight: 600;
	margin-top: 0.75rem;
	margin-bottom: 0.5rem;
	color: var(--color-foreground, currentColor);
}
.changelog-content :global(h1) { font-size: 1.125rem; }
.changelog-content :global(h2) { font-size: 1rem; }
.changelog-content :global(h3) { font-size: 0.875rem; }

.changelog-content :global(h4),
.changelog-content :global(h5),
.changelog-content :global(h6) {
	font-weight: 600;
	margin-top: 0.5rem;
	margin-bottom: 0.25rem;
	color: var(--color-foreground, currentColor);
}
.changelog-content :global(h4) { font-size: 0.825rem; }
.changelog-content :global(h5) { font-size: 0.775rem; }
.changelog-content :global(h6) { font-size: 0.75rem; }

.changelog-content :global(p) {
	margin-bottom: 0.5rem;
	line-height: 1.5;
}

.changelog-content :global(strong),
.changelog-content :global(b) {
	font-weight: 700;
}

.changelog-content :global(em),
.changelog-content :global(i) {
	font-style: italic;
}

.changelog-content :global(blockquote) {
	border-left: 3px solid var(--color-border, currentColor);
	padding-left: 0.75rem;
	color: var(--color-muted-foreground, currentColor);
	font-style: italic;
	margin-top: 0.5rem;
	margin-bottom: 0.5rem;
}

.changelog-content :global(ul) {
	list-style-type: disc;
	padding-left: 1.25rem;
	margin-bottom: 0.5rem;
}

.changelog-content :global(ol) {
	list-style-type: decimal;
	padding-left: 1.25rem;
	margin-bottom: 0.5rem;
}

.changelog-content :global(li) {
	margin-bottom: 0.25rem;
}

.changelog-content :global(pre) {
	background-color: var(--color-muted, rgba(120, 120, 120, 0.1));
	padding: 0.75rem;
	border-radius: 0.375rem;
	overflow-x: auto;
	margin-top: 0.5rem;
	margin-bottom: 0.5rem;
	border: 1px solid var(--color-border, rgba(120, 120, 120, 0.2));
}

.changelog-content :global(pre code) {
	background-color: transparent;
	padding: 0;
	font-size: 0.85em;
	border-radius: 0;
	border: none;
}

.changelog-content :global(code) {
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
	font-size: 0.85em;
	background-color: var(--color-muted, rgba(120, 120, 120, 0.15));
	padding: 0.125rem 0.25rem;
	border-radius: 0.25rem;
}

.changelog-content :global(a) {
	color: var(--color-primary, #3b82f6);
	text-decoration: underline;
}

.changelog-content :global(a:hover) {
	opacity: 0.8;
}
</style>
