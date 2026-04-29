<script lang="ts">
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as Sheet from '@/components/ui/sheet';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { animationStore } from '@/stores/animationStore.svelte';
import { notificationStore } from '@/stores/notificationStore.svelte';
import {
    AlertCircle,
    AlertTriangle,
    Bell,
    CheckCircle2,
    Info,
    X,
} from '@lucide/svelte';
import { formatDistanceToNow } from 'date-fns';
import { flip } from 'svelte/animate';
import { fade, fly, scale } from 'svelte/transition';
import { quintOut } from 'svelte/easing';


function getIcon(type: string) {
	switch (type) {
		case 'success':
			return CheckCircle2;
		case 'error':
			return AlertCircle;
		case 'warning':
			return AlertTriangle;
		default:
			return Info;
	}
}

function getIconColor(type: string) {
	switch (type) {
		case 'success':
			return 'text-green-500';
		case 'error':
			return 'text-red-500';
		case 'warning':
			return 'text-yellow-500';
		default:
			return 'text-blue-500';
	}
}
</script>

<Sheet.Root open={notificationStore.isOpen} onOpenChange={(v) => notificationStore.setIsOpen(v)}>
	<Sheet.Content
		class="w-full max-w-sm flex-col p-0 shadow-2xl border-l bg-background/95 backdrop-blur-xl transition-none duration-200 sm:max-w-sm"
		showCloseButton={false}
	>
		<Sheet.Header class="flex flex-col border-b px-6 py-4 space-y-4 text-left">
			<div class="flex flex-row items-center justify-between">
				<Sheet.Title class="flex min-w-0 items-center gap-2 font-semibold text-lg">
					<Bell class="size-5 shrink-0" />
					<span class="truncate">{t('notifications.title')}</span>
				</Sheet.Title>
				<Sheet.Close>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon"
							class="size-8 hover:bg-muted"
							aria-label={t('common.close')}
						>
							<X class="size-4" />
						</Button>
					{/snippet}
				</Sheet.Close>
			</div>
			{#if notificationStore.notifications.length > 0}
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						class="flex-1 text-xs"
						onclick={() => notificationStore.markAllAsRead()}
					>
						{t('notifications.markAllAsRead')}
					</Button>
					<Button
						variant="outline"
						size="sm"
						class="flex-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
						onclick={() => notificationStore.clearAll()}
					>
						{t('notifications.clearAll')}
					</Button>
				</div>
			{/if}
		</Sheet.Header>

		<ScrollArea class="flex-1">
			{#if notificationStore.notifications.length === 0}
				<div
					class="flex flex-col items-center justify-center p-8 text-center text-muted-foreground"
					in:fade={{ duration: animationStore.animationsEnabled ? 200 : 0 }}

				>
					<Bell class="mb-4 size-10 opacity-20" />
					<p>{t('notifications.empty')}</p>
				</div>
			{:else}
				<div class="flex flex-col divide-y">
					{#each notificationStore.notifications as notif, i (notif.id)}
						{@const IconComponent = getIcon(notif.type)}
						<div
							data-testid="notification-item"
							class={cn(
								'flex flex-col gap-1 p-4 transition-colors hover:bg-muted/50 relative',
								!notif.isRead && 'bg-primary/5'
							)}
							animate:flip={{ duration: animationStore.animationsEnabled ? 300 : 0, easing: quintOut }}
							in:fly={{ x: 20, duration: animationStore.animationsEnabled ? 200 : 0, delay: i * 50, easing: quintOut }}
							out:fade={{ duration: animationStore.animationsEnabled ? 150 : 0, easing: quintOut }}

						>
							{#if !notif.isRead}
								<button class="absolute left-1.5 top-5 size-2 rounded-full cursor-pointer bg-primary transition-opacity hover:opacity-50" aria-label={t('notifications.markAsRead')} title={t('notifications.markAsRead')} onclick={() => notificationStore.markAsRead(notif.id)}></button>
							{/if}
							<div class="flex w-full items-start justify-between gap-4">
								<div class="flex items-center gap-2 font-medium text-sm">
									<IconComponent class={cn('size-4', getIconColor(notif.type))} />
									<span>{notif.title}</span>
								</div>
							</div>
							{#if notif.description}
								<p class="line-clamp-2 pl-6 text-muted-foreground text-sm">
									{notif.description}
								</p>
							{/if}
							<span class="pl-6 text-muted-foreground/60 text-xs">
								{formatDistanceToNow(notif.createdAt, { addSuffix: true })}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</ScrollArea>
	</Sheet.Content>
</Sheet.Root>
