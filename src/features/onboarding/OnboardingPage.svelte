<script lang="ts">
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { animationStore } from '@/stores/animationStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import { push } from 'svelte-spa-router';
import { fly } from 'svelte/transition';

import AnimationStep from './components/AnimationStep.svelte';
import BackupInfoStep from './components/BackupInfoStep.svelte';
import FinishStep from './components/FinishStep.svelte';
import TelemetryStep from './components/TelemetryStep.svelte';
import ThemeStep from './components/ThemeStep.svelte';
import WelcomeStep from './components/WelcomeStep.svelte';

let step = $state(0);
let direction = $state(1); // 1 for forward, -1 for backward

const STEPS = [
        { id: 'welcome', titleKey: 'onboarding.welcome', component: WelcomeStep },
        { id: 'theme', titleKey: 'onboarding.theme', component: ThemeStep },
        { id: 'animations', titleKey: 'onboarding.animations', component: AnimationStep },
        { id: 'telemetry', titleKey: 'onboarding.telemetry', component: TelemetryStep },
        { id: 'backups', titleKey: 'onboarding.data', component: BackupInfoStep },
        { id: 'finish', titleKey: 'onboarding.allSet', component: FinishStep },
];

function handleNext() {
        direction = 1;
        if (step < STEPS.length - 1) {
                step += 1;
        } else {
                uiStore.setOnboardingCompleted(true);
                void push('/');
        }
}

function handleBack() {
        direction = -1;
        if (step > 0) step -= 1;
}
</script>

<div class="relative flex min-h-screen w-full items-center justify-center bg-background p-6">
        <div class="pointer-events-none absolute inset-0 overflow-hidden">
                <div class="absolute top-1/3 left-1/4 h-125 w-125 rounded-full bg-[oklch(0.67_0.18_275/6%)] blur-[120px]"></div>
                <div class="absolute right-1/4 bottom-1/3 h-100 w-100 rounded-full bg-[oklch(0.55_0.22_290/5%)] blur-[100px]"></div>
        </div>
        <div class="relative flex h-150 w-full max-w-150 flex-col overflow-hidden rounded-xl border border-primary/10 bg-card shadow-2xl">
                <!-- Progress -->
                <div class="flex justify-center gap-3 pt-8 pb-4" role="img" aria-label={t('onboarding.stepOf', { current: step + 1, total: STEPS.length, title: t(STEPS[step].titleKey) })}>
                        {#each STEPS as s, index (s.id)}
                                <div
                                        aria-hidden="true"
                                        class={cn(
                                                'h-2 rounded-full transition-all duration-150 ease-in-out',
                                                index === step ? 'w-8 bg-primary shadow-[0_0_10px_2px] shadow-primary/40' : index < step ? 'w-2 bg-primary/40' : 'w-2 bg-muted-foreground/30',
                                        )}
                                ></div>
                        {/each}
                </div>

                <!-- Content Area -->
                <div class="relative flex-1 overflow-hidden">
                        {#key step}
                                <div class="absolute inset-0 flex flex-col" in:fly={{ x: direction * 40, duration: animationStore.animationsEnabled ? 200 : 0 }} out:fly={{ x: -direction * 40, duration: animationStore.animationsEnabled ? 200 : 0 }}>
                                        {#if step === 0}
                                                <WelcomeStep onNext={handleNext} />
                                        {:else if step === 1}
                                                <ThemeStep onNext={handleNext} onBack={handleBack} />
                                        {:else if step === 2}
                                                <AnimationStep onNext={handleNext} onBack={handleBack} />
                                        {:else if step === 3}
                                                <TelemetryStep onNext={handleNext} onBack={handleBack} />
                                        {:else if step === 4}
                                                <BackupInfoStep onNext={handleNext} onBack={handleBack} />
                                        {:else if step === 5}
                                                <FinishStep onNext={handleNext} onBack={handleBack} />
                                        {/if}
                                </div>
                        {/key}
                </div>	</div>
</div>
