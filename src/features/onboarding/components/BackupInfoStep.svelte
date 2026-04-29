<script lang="ts">
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { ArrowLeft, ShieldCheck } from '@lucide/svelte';
import { scale } from 'svelte/transition';

import { animationStore } from '@/stores/animationStore.svelte';

let { onNext, onBack }: { onNext: () => void; onBack: () => void } = $props();


const backupItems = [
	{ id: 'runsSilently', label: () => t('backupInfoStep.runsSilently') },
	{ id: 'storedSecurely', label: () => t('backupInfoStep.storedSecurely') },
	{
		id: 'fullyConfigurable',
		label: () => t('backupInfoStep.fullyConfigurable'),
	},
];
</script>

<div class="flex flex-1 flex-col items-center justify-center gap-6 px-12">
	<div class="w-fit rounded-full bg-blue-500/10 p-6" in:scale={{ duration: animationStore.animationsEnabled ? 300 : 0 }}>

		<ShieldCheck class="size-12 text-blue-500" />
	</div>
	<h2 class="text-center font-bold text-3xl">{t('backupInfoStep.title')}</h2>
	<div class="mx-auto flex w-full max-w-lg flex-col gap-6 pb-8">
		<p class="text-center text-muted-foreground leading-relaxed">{t('backupInfoStep.description')}</p>
		<div class="rounded-2xl border bg-card p-6 shadow-sm">
			<div class="flex flex-col gap-4">
				{#each backupItems as item (item.id)}
					<div class="flex items-center gap-3">
						<div class="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
							<div class="size-2 rounded-full bg-blue-500"></div>
						</div>
						<span class="font-medium text-muted-foreground text-sm">{item.label()}</span>
					</div>
				{/each}
			</div>
		</div>
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
