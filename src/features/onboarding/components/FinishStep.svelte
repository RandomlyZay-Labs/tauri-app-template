<script lang="ts">
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { Check } from '@lucide/svelte';
import { scale } from 'svelte/transition';

import { animationStore } from '@/stores/animationStore.svelte';

let { onNext, onBack }: { onNext: () => void; onBack: () => void } = $props();

</script>

<div class="flex flex-1 flex-col items-center justify-center gap-6 px-12">
	<div class="w-fit rounded-full bg-green-500/10 p-6" in:scale={{ duration: animationStore.animationsEnabled ? 300 : 0 }}>

		<Check class="size-12 text-green-500" />
	</div>
	<h2 class="text-center font-bold text-3xl">{t('finishStep.title')}</h2>
	<p class="text-center text-lg text-muted-foreground leading-relaxed">{t('finishStep.description')}</p>
</div>
<div class="flex flex-col items-center gap-4 px-12 pb-12">
	<Button size="lg" class="w-full sm:w-64" onclick={onNext}>
		{t('common.done')}
	</Button>
	<Button variant="ghost" size="lg" onclick={onBack}>
		{t('finishStep.backToPreferences')}
	</Button>
</div>
