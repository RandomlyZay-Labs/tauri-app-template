<script lang="ts">
import NotificationsSheet from '@/components/NotificationsSheet.svelte';
import UpdateBanner from '@/components/UpdateBanner.svelte';
import { t } from '@/lib/i18n';
import { uiStore } from '@/stores/uiStore.svelte';
import { tick } from 'svelte';
import Sidebar from './Sidebar.svelte';

import { TooltipProvider } from '@/components/ui/tooltip';

import { router } from 'svelte-spa-router';

$effect(() => {
	void router.location;
	void tick().then(() => {
		document.getElementById('main-content')?.focus();
	});
});

let { children } = $props<{ children?: import('svelte').Snippet }>();
</script>

{#if uiStore._hasHydrated}
	<TooltipProvider delayDuration={400}>
		<div class="flex h-screen w-full overflow-hidden bg-background">
			<a
				href="#main-content"
				class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary"
			>
				{t('layout.skipToMainContent')}
			</a>
			<Sidebar />
			<main
				id="main-content"
				tabindex="-1"
				class="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth outline-none transition-all duration-150"
			>
				<UpdateBanner />
				<div class="container mx-auto max-w-7xl p-6">
					{@render children?.()}
				</div>
			</main>
			<NotificationsSheet />
		</div>
	</TooltipProvider>
{/if}
