<script lang="ts">
import { Button } from '@/components/ui/button';
import { updateStore } from '@/stores/updateStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import { push } from 'svelte-spa-router';
import { ArrowRight, Info, X } from '@lucide/svelte';
import { slide } from 'svelte/transition';
import { t } from '@/lib/i18n';

function handleViewDetails() {
	uiStore.setActiveSettingsTab('updates');
	void push('/settings');
}

function handleDismiss() {
	updateStore.hasUnseenUpdate = false;
}
</script>

{#if updateStore.hasUnseenUpdate && uiStore.onboardingCompleted}
	<div
		transition:slide={{ duration: 150 }}
		class="relative bg-primary/10 border-b border-primary/20 text-foreground py-2.5 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 font-medium text-xs md:text-sm animate-in fade-in"
	>
		<div class="flex items-center gap-2">
			<Info class="size-4 text-primary shrink-0 animate-pulse" />
			<span>
				{t('updateSettings.bannerTitle', { version: updateStore.version })}
			</span>
		</div>
		<div class="flex items-center gap-2 md:gap-3 shrink-0">
			<Button
				variant="outline"
				size="sm"
				class="h-8 text-xs font-semibold hover:bg-primary/20 hover:text-primary transition-all duration-150 border-primary/30"
				onclick={handleViewDetails}
			>
				{t('updateSettings.bannerAction')}
				<ArrowRight class="ml-1 size-3" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				class="size-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
				onclick={handleDismiss}
				aria-label={t('updateSettings.bannerDismiss')}
			>
				<X class="size-4" />
			</Button>
		</div>
	</div>
{/if}
