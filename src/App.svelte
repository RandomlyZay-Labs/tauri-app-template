<!-- SPDX-License-Identifier: MIT -->
<script lang="ts">
import ActivityCenter from '@/components/ActivityCenter.svelte';
import CommandPalette from '@/components/CommandPalette.svelte';
import { Button } from '@/components/ui/button';
import * as Card from '@/components/ui/card';
import AboutPage from '@/features/about/AboutPage.svelte';
import HomePage from '@/features/home/HomePage.svelte';
import OnboardingPage from '@/features/onboarding/OnboardingPage.svelte';
import SettingsPage from '@/features/settings/SettingsPage.svelte';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { commands } from '@/lib/ipc';
import { toast } from '@/lib/toast';
import { uiStore } from '@/stores/uiStore.svelte';
import { AlertTriangle, Download, Home, RefreshCw } from '@lucide/svelte';
import { onDestroy, onMount } from 'svelte';
import { Toaster } from '@/components/ui/sonner';
import Router, { push, router } from 'svelte-spa-router';

import { mapErrorToI18n } from '@/lib/error-utils';
import { lifecycleManager } from '@/lib/lifecycle.svelte';
import { initTelemetry } from '@/lib/telemetry';

const routes = {
	'/': HomePage,
	'/settings': SettingsPage,
	'/about': AboutPage,
	'/onboarding': OnboardingPage,
};

$effect(() => {
	if (uiStore._hasHydrated) {
		if (!uiStore.onboardingCompleted && router.location !== '/onboarding') {
			void push('/onboarding');
		}
		// Telemetry is initialized here — after hydration — so that the user's
		// persisted consent state is available before PostHog starts capturing.
		initTelemetry();
	}
});

let cleanups: (() => void)[] = [];

onMount(async () => {
	await lifecycleManager.init();

	// Global F11 keydown listener for fullscreen
	const handleKeyDown = async (e: KeyboardEvent) => {
		if (e.key === 'F11') {
			e.preventDefault();
			try {
				const { getCurrentWindow } = await import('@tauri-apps/api/window');
				const currentWin = getCurrentWindow();
				const fs = await currentWin.isFullscreen();
				await currentWin.setFullscreen(!fs);
				uiStore.setIsFullscreen(!fs);
			} catch (err) {
				console.error('Failed to toggle fullscreen:', err);
			}
		}
	};
	window.addEventListener('keydown', handleKeyDown);
	cleanups.push(() => window.removeEventListener('keydown', handleKeyDown));

	// Track window resize events to keep fullscreen state in sync
	try {
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		const currentWin = getCurrentWindow();
		const updateFullscreenState = async () => {
			const fs = await currentWin.isFullscreen();
			uiStore.setIsFullscreen(fs);
		};
		
		await updateFullscreenState();
		const unlisten = await currentWin.onResized(() => {
			void updateFullscreenState();
		});
		cleanups.push(() => unlisten());
	} catch (err) {
		console.error('Failed to sync fullscreen state:', err);
	}
});

onDestroy(() => {
	lifecycleManager.destroy();
	for (const cleanup of cleanups) {
		cleanup();
	}
});

async function handleExportDiagnostics() {
	await executeSafeAction(
		async () => {
			const saved = await commands.exportDiagnostics();
			if (saved) {
				toast.success(t('debugSettings.exportLogsSuccess'));
			}
		},
		{ errorMessage: t('debugSettings.exportLogsFailed') }
	);
}

function getLocalizedErrorMessage(error: unknown): string {
	if (typeof error === 'string') {
		// Check if it's a Rust error string like "Validation: URL must..."
		const colonIndex = error.indexOf(':');

		if (colonIndex !== -1) {
			const type = error.substring(0, colonIndex).trim();
			const message = error.substring(colonIndex + 1).trim();
			return mapErrorToI18n(type, message);
		}
		return error;
	}

	if (error && typeof error === 'object') {
		const errObj = error as Record<string, any>;

		if ('type' in errObj && 'message' in errObj) {
			return mapErrorToI18n(String(errObj.type), String(errObj.message));
		}
	}

	return error instanceof Error ? error.message : String(error);
}
</script>

<svelte:boundary>
	<Router {routes} />
	<Toaster position={uiStore.toastPosition} />
	<CommandPalette />
	<ActivityCenter />

	{#snippet failed(error)}
		{@const errorMessage = getLocalizedErrorMessage(error)}
		<div class="flex min-h-screen items-center justify-center bg-background p-4">
			<Card.Root class="w-full max-w-md border-destructive/50 shadow-lg text-center">
				<Card.Header>
					<div class="mx-auto w-fit rounded-full bg-destructive/10 p-3 mb-2">
						<AlertTriangle class="size-8 text-destructive" />
					</div>
					<Card.Title class="text-xl">{t('errors.somethingWentWrong')}</Card.Title>
					<Card.Description>{t('errors.unexpectedError')}</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="max-h-32 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs text-left">
						{errorMessage}
					</div>
					<div class="flex flex-col gap-2">
						<Button variant="outline" class="w-full justify-start" onclick={() => window.location.href = '/'}>
							<Home class="mr-2 size-4" />
							{t('common.home')}
						</Button>
						<Button class="w-full justify-start" onclick={() => window.location.reload()}>
							<RefreshCw class="mr-2 size-4" />
							{t('errors.reload')}
						</Button>
						<Button variant="secondary" class="w-full justify-start" onclick={handleExportDiagnostics}>
							<Download class="mr-2 size-4" />
							{t('debugSettings.exportLogs')}
						</Button>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
		<Toaster position={uiStore.toastPosition} />
	{/snippet}
</svelte:boundary>