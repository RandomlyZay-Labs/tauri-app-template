<script lang="ts">
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { updateTelemetryConsent } from '@/lib/telemetry';
import { uiStore } from '@/stores/uiStore.svelte';
import { ShieldCheck } from '@lucide/svelte';
import { scale } from 'svelte/transition';

import { animationStore } from '@/stores/animationStore.svelte';

function handleToggle(enabled: boolean) {
	uiStore.setTelemetryEnabled(enabled);
	updateTelemetryConsent(enabled);
}
</script>

<div class="flex flex-col h-full w-full max-w-lg mx-auto">
	<!-- Standardized Header Container -->
	<div class="flex flex-col items-center text-center gap-4 pt-8">
		<div class="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-md" in:scale={{ duration: animationStore.animationsEnabled ? 300 : 0 }}>
			<ShieldCheck class="size-10" />
		</div>
		<h2 class="font-bold text-3xl tracking-tight">{t('telemetryStep.title')}</h2>
		<p class="text-center text-base text-muted-foreground leading-relaxed max-w-md">{t('telemetryStep.description')}</p>
	</div>

	<!-- Standardized Content Container -->
	<div class="flex-1 flex flex-col justify-center items-center py-6 w-full">
		<div class={cn('w-full flex items-center justify-between space-x-4 rounded-2xl border-2 p-8 transition-colors', uiStore.telemetryEnabled ? 'border-primary/50 bg-primary/5' : 'border-border')}>
			<div class="flex-1 text-left space-y-1">
				<Label for="telemetry-toggle" class="font-semibold text-base block cursor-pointer">
					{t('telemetryStep.optIn')}
				</Label>
				<p class="text-muted-foreground text-sm leading-relaxed">
					{t('telemetryStep.optInDescription')}
				</p>
			</div>
			<Switch
				id="telemetry-toggle"
				checked={uiStore.telemetryEnabled}
				onCheckedChange={handleToggle}
			/>
		</div>
	</div>
</div>
