<script lang="ts">
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { THEME_OPTIONS, themeStore } from '@/stores/themeStore.svelte';
import { Laptop, Moon, Sun, Palette } from '@lucide/svelte';
import { scale } from 'svelte/transition';
import { animationStore } from '@/stores/animationStore.svelte';

function getThemeIcon(value: string) {
	switch (value) {
		case 'light': return Sun;
		case 'dark': return Moon;
		default: return Laptop;
	}
}
</script>

<div class="flex flex-col h-full w-full max-w-lg mx-auto">
	<!-- Standardized Header Container -->
	<div class="flex flex-col items-center text-center gap-4 pt-8">
		<div class="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-md" in:scale={{ duration: animationStore.animationsEnabled ? 300 : 0 }}>
			<Palette class="size-10" />
		</div>
		<h2 class="font-bold text-3xl tracking-tight">{t('themeStep.title')}</h2>
		<p class="text-center text-base text-muted-foreground leading-relaxed max-w-md">{t('themeStep.description')}</p>
	</div>

	<!-- Standardized Content Container -->
	<div class="flex-1 flex flex-col justify-center items-center py-6 w-full">
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
</div>
