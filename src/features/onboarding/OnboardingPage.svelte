<!-- SPDX-License-Identifier: MIT -->
<script lang="ts">
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { uiStore } from '@/stores/uiStore.svelte';
import { push } from 'svelte-spa-router';
import { ArrowLeft, ArrowRight } from '@lucide/svelte';
import { Button } from '@/components/ui/button';
import * as Carousel from '@/components/ui/carousel';
import type { CarouselAPI } from '@/components/ui/carousel/context';

import AnimationStep from './components/AnimationStep.svelte';
import BackupInfoStep from './components/BackupInfoStep.svelte';
import FinishStep from './components/FinishStep.svelte';
import TelemetryStep from './components/TelemetryStep.svelte';
import ThemeStep from './components/ThemeStep.svelte';
import WelcomeStep from './components/WelcomeStep.svelte';
import WindowTitlebar from '@/components/layout/titlebar/WindowTitlebar.svelte';

let api = $state<CarouselAPI>();
let current = $state(0);

const STEPS = [
	{ id: 'welcome', titleKey: 'onboarding.welcome', component: WelcomeStep },
	{ id: 'theme', titleKey: 'onboarding.theme', component: ThemeStep },
	{ id: 'animations', titleKey: 'onboarding.animations', component: AnimationStep },
	{ id: 'telemetry', titleKey: 'onboarding.telemetry', component: TelemetryStep },
	{ id: 'backups', titleKey: 'onboarding.data', component: BackupInfoStep },
	{ id: 'finish', titleKey: 'onboarding.allSet', component: FinishStep },
];

$effect(() => {
	if (!api) return;
	current = api.selectedScrollSnap();
	api.on('select', () => {
		if (api) current = api.selectedScrollSnap();
	});
});

function handleNext() {
	if (!api) return;
	if (current < STEPS.length - 1) {
		api.scrollNext();
	} else {
		uiStore.setOnboardingCompleted(true);
		void push('/');
	}
}

function handleBack() {
	if (!api) return;
	if (current > 0) {
		api.scrollPrev();
	}
}
</script>

<div class="flex h-screen w-full flex-col overflow-hidden bg-background">
	<WindowTitlebar>
		<span class="text-xs font-semibold text-muted-foreground/80 tracking-wide">{t('sidebar.appName')}</span>
	</WindowTitlebar>

	<div class="relative flex-1 flex w-full items-center justify-center p-6 min-h-0 overflow-y-auto">
		<div class="pointer-events-none absolute inset-0 overflow-hidden">
			<div class="absolute top-1/3 left-1/4 h-125 w-125 rounded-full bg-[oklch(0.67_0.18_275/6%)] blur-[120px]"></div>
			<div class="absolute right-1/4 bottom-1/3 h-100 w-100 rounded-full bg-[oklch(0.55_0.22_290/5%)] blur-[100px]"></div>
		</div>
		<div class="relative flex h-150 w-full max-w-150 flex-col overflow-hidden rounded-xl border border-primary/10 bg-card shadow-2xl">
			<!-- Progress -->
			<div class="flex justify-center gap-3 pt-8 pb-2" role="img" aria-label={t('onboarding.stepOf', { current: current + 1, total: STEPS.length, title: t(STEPS[current]?.titleKey || '') })}>
				{#each STEPS as s, index (s.id)}
					<div
						aria-hidden="true"
						class={cn(
							'h-2 rounded-full transition-all duration-150 ease-in-out',
							index === current ? 'w-8 bg-primary shadow-[0_0_10px_2px] shadow-primary/40' : index < current ? 'w-2 bg-primary/40' : 'w-2 bg-muted-foreground/30',
						)}
					></div>
				{/each}
			</div>

			<!-- Content Carousel -->
			<Carousel.Root setApi={(emblaApi) => (api = emblaApi)} opts={{ watchDrag: false }} class="flex-1 min-h-0 flex flex-col overflow-hidden">
				<Carousel.Content class="flex-1 h-full">
					{#each STEPS as s, index (s.id)}
						{@const StepComponent = s.component}
						<Carousel.Item class="h-full flex flex-col justify-center">
							<StepComponent />
						</Carousel.Item>
					{/each}
				</Carousel.Content>
			</Carousel.Root>

			<!-- Navigation buttons -->
			<div class="flex items-center justify-between px-12 pb-12 pt-4">
				{#if current > 0}
					<Button variant="ghost" size="lg" onclick={handleBack}>
						<ArrowLeft class="size-4 mr-2" />
						{t('common.back')}
					</Button>
				{:else}
					<div></div>
				{/if}

				<Button size="lg" class={cn("px-8 shadow-lg", current === 0 && "w-full sm:w-auto")} onclick={handleNext}>
					{#if current === 0}
						{t('welcomeStep.getStarted')}
						<ArrowRight class="size-5 ml-2" />
					{:else if current === STEPS.length - 1}
						{t('common.done')}
					{:else}
						{t('common.next')}
						<ArrowRight class="size-4 ml-2" />
					{/if}
				</Button>
			</div>
		</div>
	</div>
</div>

<style>
:global([data-slot="carousel-content"]) {
	flex: 1 1 0%;
	height: 100%;
}
:global([data-slot="carousel-content"] > [data-embla-container]) {
	height: 100%;
}
</style>
