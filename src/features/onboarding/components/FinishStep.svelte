<!-- SPDX-License-Identifier: MIT -->
<script lang="ts">
import { t } from '@/lib/i18n';
import { Check } from '@lucide/svelte';
import { scale } from 'svelte/transition';

import { animationStore } from '@/stores/animationStore.svelte';
</script>

<div class="flex flex-col h-full w-full max-w-lg mx-auto">
	<!-- Standardized Header Container -->
	<div class="flex flex-col items-center text-center gap-4 pt-8">
		<div class="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-md" in:scale={{ duration: animationStore.animationsEnabled ? 300 : 0 }}>
			<Check class="size-10" />
		</div>
		<h2 class="font-bold text-3xl tracking-tight">{t('finishStep.title')}</h2>
	</div>

	<!-- Standardized Content Container -->
	<div class="flex-1 flex flex-col justify-center items-center py-6 w-full">
		<p class="text-center text-lg text-muted-foreground leading-relaxed max-w-md">{t('finishStep.description')}</p>
	</div>
</div>
