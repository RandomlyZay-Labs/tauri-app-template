<!-- SPDX-License-Identifier: MIT -->
<script lang="ts">
import { t } from '@/lib/i18n';
import { Database } from '@lucide/svelte';
import { scale } from 'svelte/transition';

import { animationStore } from '@/stores/animationStore.svelte';

const backupItems = [
	{ id: 'runsSilently', label: () => t('backupInfoStep.runsSilently') },
	{ id: 'storedSecurely', label: () => t('backupInfoStep.storedSecurely') },
	{
		id: 'fullyConfigurable',
		label: () => t('backupInfoStep.fullyConfigurable'),
	},
];
</script>

<div class="flex flex-col h-full w-full max-w-lg mx-auto">
	<!-- Standardized Header Container -->
	<div class="flex flex-col items-center text-center gap-4 pt-8">
		<div class="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-md" in:scale={{ duration: animationStore.animationsEnabled ? 300 : 0 }}>
			<Database class="size-10" />
		</div>
		<h2 class="font-bold text-3xl tracking-tight">{t('backupInfoStep.title')}</h2>
		<p class="text-center text-base text-muted-foreground leading-relaxed max-w-md">{t('backupInfoStep.description')}</p>
	</div>

	<!-- Standardized Content Container -->
	<div class="flex-1 flex flex-col justify-center items-center py-6 w-full">
		<div class="w-full rounded-2xl border bg-card p-6 shadow-sm">
			<div class="flex flex-col gap-4 text-left">
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
