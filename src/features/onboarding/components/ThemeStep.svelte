<script lang="ts">
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { THEME_OPTIONS, themeStore } from '@/stores/themeStore.svelte';
import { ArrowLeft, Laptop, Moon, Sun } from '@lucide/svelte';

let { onNext, onBack }: { onNext: () => void; onBack: () => void } = $props();

function getThemeIcon(value: string) {
	switch (value) {
		case 'light': return Sun;
		case 'dark': return Moon;
		default: return Laptop;
	}
}
</script>

<div class="flex flex-1 flex-col items-center justify-center gap-6 px-12">
	<h2 class="text-center font-bold text-3xl">{t('themeStep.title')}</h2>
	<p class="text-center text-muted-foreground">{t('themeStep.description')}</p>
	<div class="grid w-full grid-cols-3 gap-6">
		{#each THEME_OPTIONS as opt (opt.value)}
			{@const Icon = getThemeIcon(opt.value)}
			<Button
				variant="outline"
				class={cn(
					'flex h-auto flex-col items-center justify-center gap-4 rounded-2xl border-2 p-6 transition-all duration-200',
					themeStore.theme === opt.value
						? 'scale-105 border-primary bg-primary/5 text-primary shadow-md'
						: 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50',
				)}
				onclick={() => themeStore.setTheme(opt.value)}
			>
				<Icon class={cn('size-10 transition-colors', themeStore.theme === opt.value ? 'fill-current' : '')} />
				<span class="font-semibold text-base">{t(opt.labelKey)}</span>
			</Button>
		{/each}
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
