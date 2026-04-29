<script lang="ts">
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { ArrowRight, Sparkles } from '@lucide/svelte';
import { scale } from 'svelte/transition';

import { animationStore } from '@/stores/animationStore.svelte';

let { onNext }: { onNext: () => void } = $props();
</script>

<div class="flex flex-1 flex-col items-center justify-center gap-6 px-12">
	<div class="w-fit rounded-full bg-primary/10 p-6" in:scale={{ duration: animationStore.animationsEnabled ? 300 : 0 }}>

		<Sparkles class="size-12 text-primary" />
	</div>
	<h2 class="text-center font-bold text-3xl">{t('welcomeStep.title')}</h2>
	<p class="text-center text-lg text-muted-foreground leading-relaxed">{t('welcomeStep.description')}</p>
</div>
<div class="flex justify-center px-12 pb-12">
	<Button size="lg" class="px-8 shadow-lg" onclick={onNext}>
		{t('welcomeStep.getStarted')} <ArrowRight class="size-5 ml-2" />
	</Button>
</div>
