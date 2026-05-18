<script lang="ts">
import AppLayout from '@/components/layout/AppLayout.svelte';
import { t } from '@/lib/i18n';
import { Command } from '@lucide/svelte';
import FileWatcherCard from './components/FileWatcherCard.svelte';
import SecureStorageCard from './components/SecureStorageCard.svelte';

function getGreetingKey(): string {
	const hour = new Date().getHours();
	if (hour < 12) return 'home.greetingMorning';
	if (hour < 18) return 'home.greetingAfternoon';
	return 'home.greetingEvening';
}

const isMac = navigator.userAgent.includes('Mac');
const shortcutLabel = isMac ? t('home.shortcutMac') : t('home.shortcutWindows');
</script>

<AppLayout>
	<div class="space-y-8">
		<div class="space-y-2">
			<h1 class="text-gradient-primary font-extrabold text-4xl tracking-tight">{t(getGreetingKey())}</h1>
			<div class="flex items-center gap-3">
				<p class="text-muted-foreground">{t('home.title')}</p>
				<button
					class="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/50 px-2.5 py-1 text-muted-foreground/60 text-xs transition-colors hover:bg-muted hover:text-muted-foreground"
					onclick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: !isMac, metaKey: isMac }))}
				>
					<Command class="size-3" />
					<span class="font-medium">{shortcutLabel}</span>
				</button>
			</div>
		</div>

		<div class="grid gap-6 lg:grid-cols-2">
			<SecureStorageCard />
			<FileWatcherCard />
		</div>
	</div>
</AppLayout>
