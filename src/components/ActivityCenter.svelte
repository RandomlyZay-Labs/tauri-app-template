<script lang="ts">
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as Sheet from '@/components/ui/sheet';
import { t } from '@/lib/i18n';
import { cn, formatDuration, formatSpeed } from '@/lib/utils';
import {
    type ActivityStatus,
    activityStore,
} from '@/stores/activityStore.svelte';
import { animationStore } from '@/stores/animationStore.svelte';
import {
    Activity as ActivityIcon,
    AlertCircle,
    Ban,
    CheckCircle2,
    Clock,
    Trash2,
    Unplug,
    X,
    Zap,
} from '@lucide/svelte';
import { formatDistanceToNow } from 'date-fns';
import { flip } from 'svelte/animate';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { quintOut } from 'svelte/easing';
import { fade, fly } from 'svelte/transition';


const STATUS_CONFIG: Record<
	ActivityStatus,
	{ icon: typeof Clock; className: string; i18nKey: string }
> = {
	pending: {
		icon: Clock,
		className: 'text-muted-foreground',
		i18nKey: 'activityCenter.statusPending',
	},
	running: {
		icon: Spinner,
		className: 'text-blue-500',
		i18nKey: 'activityCenter.statusRunning',
	},
	completed: {
		icon: CheckCircle2,
		className: 'text-green-500',
		i18nKey: 'activityCenter.statusCompleted',
	},
	failed: {
		icon: AlertCircle,
		className: 'text-destructive',
		i18nKey: 'activityCenter.statusFailed',
	},
	cancelled: {
		icon: Ban,
		className: 'text-muted-foreground',
		i18nKey: 'activityCenter.statusCancelled',
	},
	interrupted: {
		icon: Unplug,
		className: 'text-yellow-500',
		i18nKey: 'activityCenter.statusInterrupted',
	},
};

let activities = $derived(activityStore.getSortedActivities());
let hasTerminal = $derived(
	activities.some(
		(a) =>
			a.status === 'completed' ||
			a.status === 'failed' ||
			a.status === 'cancelled' ||
			a.status === 'interrupted',
	),
);
</script>

<Sheet.Root open={activityStore.isOpen} onOpenChange={(v) => activityStore.setIsOpen(v)}>
	<Sheet.Content
		class="w-full max-w-sm flex-col p-0 shadow-2xl border-l bg-background/95 backdrop-blur-xl transition-none duration-200 sm:max-w-sm"
		showCloseButton={false}
	>
		<Sheet.Header class="flex flex-row items-center justify-between border-b px-6 py-4 space-y-0 text-left">
			<Sheet.Title class="flex min-w-0 items-center gap-2 font-semibold text-lg">
				<ActivityIcon class="size-5 shrink-0" />
				<span class="truncate">{t('activityCenter.title')}</span>
			</Sheet.Title>
			<div class="flex shrink-0 items-center gap-2">
				{#if hasTerminal}
					<Button
						variant="link"
						size="sm"
						class="h-auto p-0 px-2 text-primary text-xs"
						onclick={() => activityStore.clearCompleted()}
					>
						{t('activityCenter.clearCompleted')}
					</Button>
				{/if}
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
		</Sheet.Header>

		<ScrollArea class="flex-1">
			{#if activities.length === 0}
				<div
					class="flex h-32 items-center justify-center text-muted-foreground text-sm"
					in:fade={{ duration: animationStore.animationsEnabled ? 200 : 0 }}

				>
					{t('activityCenter.empty')}
				</div>
			{:else}
				<div class="space-y-0.5 py-1">
					{#each activities as activity, i (activity.id)}
						{@const config = STATUS_CONFIG[activity.status]}
						{@const StatusIcon = config.icon}
						{@const timeAgo = formatDistanceToNow(new Date(activity.updatedAt), { addSuffix: true })}
						<div
							class="group flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/50"
							data-testid="activity-item"
							animate:flip={{ duration: animationStore.animationsEnabled ? 300 : 0, easing: quintOut }}
							in:fly={{ x: 20, duration: animationStore.animationsEnabled ? 200 : 0, delay: i * 50, easing: quintOut }}
							out:fade={{ duration: animationStore.animationsEnabled ? 150 : 0, easing: quintOut }}

						>
							<StatusIcon class={cn('mt-0.5 size-4 shrink-0', config.className)} />

							<div class="min-w-0 flex-1 space-y-1">
								<div class="flex items-center justify-between gap-2">
									<p class="truncate font-medium text-sm leading-tight">{activity.label}</p>
									<span class="shrink-0 text-muted-foreground text-xs">{timeAgo}</span>
								</div>
								{#if activity.message}
									<p class="truncate text-muted-foreground text-xs">{activity.message}</p>
								{/if}
								{#if activity.status === 'running' && activity.progress !== null}
									<Progress value={activity.progress} class="mt-1.5 h-1.5 bg-muted [&>[data-slot=progress-indicator]]:transition-none" />
									<div class="flex items-center justify-between mt-1.5 text-[10px] font-medium text-muted-foreground/80 tabular-nums">
										<div class="flex items-center gap-2">
											{#if activity.speedBps !== null}
												<span class="flex items-center gap-1">
													<Zap class="size-2.5 text-blue-500" />
													{formatSpeed(activity.speedBps)}
												</span>
											{/if}
											{#if activity.etaSecs !== null}
												<span class="flex items-center gap-1">
													<Clock class="size-2.5 text-orange-500" />
													{formatDuration(activity.etaSecs)}
												</span>
											{/if}
										</div>
										<span class="flex items-center gap-1">
											{t(config.i18nKey)}
										</span>
									</div>
								{:else}
									<p class="text-muted-foreground text-xs">{t(config.i18nKey)}</p>
								{/if}
							</div>

							{#if activity.status === 'running' || activity.status === 'pending'}
								<Button
									variant="ghost"
									size="icon"
									class="mt-0.5 size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive hover:bg-destructive/10 group-hover:opacity-100"
									onclick={() => {
										void activityStore.cancelActivity(activity.id);
									}}
									aria-label={t('jobsCard.cancel')}
								>
									<Ban class="size-3.5" />
								</Button>
							{/if}

							<Button
								variant="ghost"
								size="icon"
								class="mt-0.5 size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive hover:bg-destructive/10 group-hover:opacity-100"
								onclick={() => activityStore.removeActivity(activity.id)}
								aria-label={t('activityCenter.removeActivity')}
							>
								<Trash2 class="size-3.5" />
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</ScrollArea>
	</Sheet.Content>
</Sheet.Root>
