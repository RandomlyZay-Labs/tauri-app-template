<script lang="ts">
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { t } from '@/lib/i18n';
import { updateTelemetryConsent } from '@/lib/telemetry';
import { uiStore } from '@/stores/uiStore.svelte';
import { ShieldCheck } from '@lucide/svelte';

interface Props {
	onNext: () => void;
	onBack: () => void;
}

const { onNext, onBack }: Props = $props();

function handleToggle(enabled: boolean) {
	uiStore.setTelemetryEnabled(enabled);
	updateTelemetryConsent(enabled);
}
</script>

<div class="flex flex-1 flex-col p-8">
	<div class="flex flex-1 flex-col items-center justify-center space-y-8 text-center">
		<div class="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
			<ShieldCheck class="size-10" />
		</div>

		<div class="max-w-100 space-y-4">
			<h2 class="font-bold text-2xl tracking-tight">{t('telemetryStep.title')}</h2>
			<p class="text-muted-foreground leading-relaxed">
				{t('telemetryStep.description')}
			</p>
		</div>

		<div class="w-full max-w-100 rounded-xl border bg-muted/30 p-6">
			<div class="flex items-center justify-between space-x-4">
				<div class="flex-1 text-left space-y-1">
					<Label for="telemetry-toggle" class="font-semibold text-base">
						{t('telemetryStep.optIn')}
					</Label>
					<p class="text-muted-foreground text-sm">
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

	<div class="mt-auto flex justify-between gap-4 pt-8">
		<Button variant="ghost" onclick={onBack}>
			{t('common.back')}
		</Button>
		<Button class="min-w-32" onclick={onNext}>
			{t('common.next')}
		</Button>
	</div>
</div>
