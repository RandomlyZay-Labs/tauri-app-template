<script lang="ts">
import AppLayout from '@/components/layout/AppLayout.svelte';
import { Button } from '@/components/ui/button';
import { getAppVersion } from '@/lib/app-version.svelte';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { openExternalLink } from '@/lib/system-utils';
import { animationStore } from '@/stores/animationStore.svelte';
import { ExternalLink, Heart, Sparkles } from '@lucide/svelte';
import { fade } from 'svelte/transition';
import { Badge } from '@/components/ui/badge';


function openLink(url: string) {
	void executeSafeAction(() => openExternalLink(url), {
		errorMessage: t('about.failedToOpenLink'),
	});
}

const appVersion = $derived(getAppVersion());
</script>

<AppLayout>
	<div class="relative mx-auto flex min-h-[85vh] w-full max-w-4xl flex-col items-center justify-center overflow-hidden p-6">
		<!-- Background Decor -->
		<div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" in:fade={{ duration: animationStore.animationsEnabled ? 200 : 0 }}>

			<div class="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-[oklch(0.67_0.18_275/8%)] blur-3xl"></div>
			<div class="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-[oklch(0.55_0.22_290/8%)] blur-3xl"></div>
		</div>

		<div class="z-10 w-full space-y-12 text-center">
			<!-- Header -->
			<div class="animate-page-in relative space-y-6" style="animation-delay: 0s; {animationStore.animationsEnabled ? '' : 'animation: none; opacity: 1;'}">

				<div class="relative mx-auto w-fit rounded-3xl bg-linear-to-br from-primary/20 to-primary/5 p-8 shadow-2xl ring-1 ring-primary/20 backdrop-blur-sm transition-transform hover:scale-105">
					<div class="absolute -top-2 -right-2">
						<div class="animate-spin" style="animation-duration: 10s;" aria-hidden="true">
							<Sparkles class="size-8 fill-yellow-500/20 text-yellow-500" />
						</div>
					</div>
					<Heart class="size-20 fill-pink-500/10 text-pink-500" aria-hidden="true" />
				</div>

				<div class="space-y-2">
					<h1 class="text-gradient-primary pb-2 font-extrabold text-5xl tracking-tight">
						{t('about.title')}
					</h1>
					<p class="mx-auto max-w-lg text-muted-foreground text-xl leading-relaxed">
						{t('about.description')}
					</p>
				</div>
			</div>

			<!-- Ko-fi Button -->
			<div class="animate-page-in flex w-full justify-center" style="animation-delay: 0.1s; {animationStore.animationsEnabled ? '' : 'animation: none; opacity: 1;'}">

				<Button
					type="button"
					variant="default"
					data-testid="kofi-btn"
					class="group flex cursor-pointer items-center gap-3 rounded-full bg-[#72A5F2] h-auto px-8 py-3.5 font-bold text-white shadow-xl ring-4 ring-[#72A5F2]/10 transition-all hover:bg-[#72A5F2]/90 hover:-translate-y-0.5"
					onclick={() => openLink('https://ko-fi.com/randomlyzay')}
				>
					<img
						src="/images/kofi_symbol.svg"
						alt=""
						class="size-7 transition-transform duration-150 group-hover:rotate-12"
						aria-hidden="true"
					/>
					<span class="text-lg tracking-tight">{t('about.supportOnKofi')}</span>
				</Button>
			</div>

			<!-- GitHub & Footer -->
			<div class="animate-page-in space-y-8" style="animation-delay: 0.2s; {animationStore.animationsEnabled ? '' : 'animation: none; opacity: 1;'}">

				<div class="flex justify-center">
					<Button
						type="button"
						variant="ghost"
						data-testid="github-btn"
						class="group flex cursor-pointer items-center gap-2 rounded-full px-6 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
						onclick={() => openLink('https://github.com/RandomlyZay')}
					>
						<svg class="size-5 transition-transform group-hover:rotate-12" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
						<span>{t('about.checkOutProjects')}</span>
						<ExternalLink class="size-3 opacity-50" aria-hidden="true" />
					</Button>
				</div>

				<div class="flex flex-col items-center gap-4">
					<Badge variant="outline" class="flex items-center gap-2 rounded-full border border-border/50 bg-muted/50 px-3 py-1 font-mono text-muted-foreground/70 text-xs h-auto">
						<span>v{appVersion}</span>
						<span class="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
						<span>{t('about.license')}</span>
					</Badge>
					<p class="text-muted-foreground/40 text-xs">{t('about.madeWith')}</p>
				</div>
			</div>
		</div>
	</div>
</AppLayout>

<style>
@keyframes pageIn {
	from {
		opacity: 0;
		transform: translateY(-20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.animate-page-in {
	opacity: 0;
	animation: pageIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
</style>



