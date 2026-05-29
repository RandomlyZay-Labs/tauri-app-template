<script lang="ts">
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { animationStore } from '@/stores/animationStore.svelte';
import { Zap } from '@lucide/svelte';
import { scale } from 'svelte/transition';
</script>

<div class="flex flex-col h-full w-full max-w-lg mx-auto">
	<!-- Standardized Header Container -->
	<div class="flex flex-col items-center text-center gap-4 pt-8">
		<div class="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-md" in:scale={{ duration: animationStore.animationsEnabled ? 300 : 0 }}>
			<Zap class="size-10" />
		</div>
		<h2 class="font-bold text-3xl tracking-tight">{t('animationStep.title')}</h2>
		<p class="text-center text-base text-muted-foreground leading-relaxed max-w-md">{t('animationStep.description')}</p>
	</div>

	<!-- Standardized Content Container -->
	<div class="flex-1 flex flex-col justify-center items-center py-6 w-full">
		<div class={cn('flex w-full items-start justify-between space-x-4 rounded-2xl border-2 p-8 transition-colors', animationStore.animationsEnabled ? 'border-primary/50 bg-primary/5' : 'border-border')}>
			<div class="max-w-[80%] space-y-2 text-left">
				<Label class="cursor-pointer font-semibold text-xl block" onclick={() => animationStore.setAnimationsEnabled(!animationStore.animationsEnabled)}>
					{t('animationStep.enableAnimations')}
				</Label>
				<p class="text-muted-foreground leading-relaxed text-sm">{t('animationStep.animationsDescription')}</p>
			</div>
			<Switch checked={animationStore.animationsEnabled} onCheckedChange={() => animationStore.setAnimationsEnabled(!animationStore.animationsEnabled)} />
		</div>
	</div>
</div>
