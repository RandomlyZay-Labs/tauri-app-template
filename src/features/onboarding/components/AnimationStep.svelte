<script lang="ts">
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { animationStore } from '@/stores/animationStore.svelte';
import { ArrowLeft } from '@lucide/svelte';

let { onNext, onBack }: { onNext: () => void; onBack: () => void } = $props();
</script>

<div class="flex flex-1 flex-col items-center justify-center gap-6 px-12">
	<h2 class="text-center font-bold text-3xl">{t('animationStep.title')}</h2>
	<p class="text-center text-muted-foreground">{t('animationStep.description')}</p>
	<div class={cn('flex w-full items-start justify-between space-x-4 rounded-2xl border-2 p-8 transition-colors', animationStore.animationsEnabled ? 'border-primary/50 bg-primary/5' : 'border-border')}>
		<div class="max-w-[80%] space-y-2">
			<Label class="cursor-pointer font-semibold text-xl block" onclick={() => animationStore.setAnimationsEnabled(!animationStore.animationsEnabled)}>
				{t('animationStep.enableAnimations')}
			</Label>
			<p class="text-muted-foreground leading-relaxed">{t('animationStep.animationsDescription')}</p>
		</div>
		<Switch checked={animationStore.animationsEnabled} onCheckedChange={() => animationStore.setAnimationsEnabled(!animationStore.animationsEnabled)} />
	</div>
</div>
<div class="flex justify-between px-12 pb-12">
	<Button variant="ghost" size="lg" onclick={onBack}>
		<ArrowLeft class="size-4 mr-2" /> {t('common.back')}
	</Button>
	<Button size="lg" class="px-8" onclick={onNext}>
		{t('common.next')}
	</Button>
</div>
