<!-- SPDX-License-Identifier: MIT -->
<script lang="ts">
import { Button } from '@/components/ui/button';
import * as Tooltip from '@/components/ui/tooltip';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { activityStore } from '@/stores/activityStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import {
    Activity,
    Home,
    Info,
    PanelLeftClose,
    PanelLeftOpen,
    Settings,
} from '@lucide/svelte';
import { link, router } from 'svelte-spa-router';

const topNavigation = [{ nameKey: 'common.home', href: '/', icon: Home }];
const bottomNavigation = [
	{ nameKey: 'common.settings', href: '/settings', icon: Settings },
	{ nameKey: 'common.about', href: '/about', icon: Info },
];

let hasRunning = $derived(
	Object.values(activityStore.activities).some((a) => a.status === 'running'),
);
</script>

{#snippet NavLink(item: { icon: any; href: string }, name: string, isActive: boolean, tooltipProps: Record<string, any> = {})}
	<a
		{...tooltipProps}
		href={item.href}
		use:link
		data-testid={item.href === '/' ? 'nav-home' : `nav-${item.href.replace('/', '')}`}
		class={cn(
			'group relative flex items-center rounded-md py-2 font-medium text-sm transition-all duration-200 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:translate-x-0.5',
			isActive
				? 'bg-sidebar-accent text-sidebar-accent-foreground nav-active-bar'
				: 'text-muted-foreground',
		)}
	>
		<div class="flex w-12 shrink-0 items-center justify-center">
			<item.icon class="size-5" />
		</div>
		<span
			class={cn(
				'truncate transition-all duration-150 ease-in-out',
				uiStore.sidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0',
			)}
		>
			{name}
		</span>
	</a>
{/snippet}

{#snippet TooltipLink(item: { icon: any; href: string }, name: string, isActive: boolean)}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				{@render NavLink(item, name, isActive, props)}
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="right" sideOffset={10}>
			{name}
		</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

{#snippet NavButton(Icon: any, label: string, onclick: (e: any) => void, labelKey: string, tooltipProps: Record<string, any> = {}, showBadge = false)}
	<Button
		{...tooltipProps}
		variant="ghost"
		class="group flex h-auto w-full items-center justify-start gap-0 rounded-md px-0 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
		{onclick}
		aria-label={label}
	>
		<div class="relative flex w-12 shrink-0 items-center justify-center">
			<Icon class="size-5" />
			{#if showBadge && hasRunning}
				<span class="absolute top-0 right-2.5 size-2 animate-pulse rounded-full bg-blue-500 ring-2 ring-sidebar"></span>
			{/if}
		</div>
		<span
			class={cn(
				'truncate transition-all duration-300 ease-in-out',
				uiStore.sidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0',
			)}
		>
			{t(labelKey)}
		</span>
	</Button>
{/snippet}

{#snippet TooltipButton(Icon: any, label: string, onclick: (e: any) => void, labelKey: string, showBadge = false)}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				{@render NavButton(Icon, label, onclick, labelKey, props, showBadge)}
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="right" sideOffset={10}>
			{t(labelKey)}
		</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

<aside
	class={cn(
		'relative z-10 flex h-full flex-col border-sidebar-border border-r bg-sidebar/80 backdrop-blur-xl text-sidebar-foreground transition-all duration-150 ease-in-out',
		uiStore.sidebarOpen ? 'w-56' : 'w-16',
	)}
	aria-label={t('sidebar.sidebar')}
>
	<div class="flex h-14 items-center border-b border-sidebar-border px-2">
		<div
			class={cn(
				'overflow-hidden truncate font-bold transition-all duration-150',
				uiStore.sidebarOpen ? 'w-auto pl-3 opacity-100' : 'w-0 pl-0 opacity-0',
			)}
		>
			{t('sidebar.appName')}
		</div>

		<div class="ml-auto flex w-12 shrink-0 items-center justify-center">
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon"
							class="size-8 hover:bg-accent hover:text-accent-foreground"
							onclick={(e) => {
								uiStore.toggleSidebar();
								(e.currentTarget as HTMLButtonElement).blur();
							}}
							aria-label={uiStore.sidebarOpen ? t('sidebar.collapseSidebar') : t('sidebar.expandSidebar')}
							aria-expanded={uiStore.sidebarOpen}
						>
							{#if uiStore.sidebarOpen}
								<PanelLeftClose class="size-4" />
							{:else}
								<PanelLeftOpen class="size-4" />
							{/if}
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="right" sideOffset={10}>
					{uiStore.sidebarOpen ? t('sidebar.collapseSidebar') : t('sidebar.expandSidebar')}
				</Tooltip.Content>
			</Tooltip.Root>
		</div>
	</div>

	<nav class="flex flex-1 flex-col overflow-hidden p-2" aria-label={t('sidebar.mainNavigation')}>
		<div class="flex-1 space-y-1">
			{#each topNavigation as item}
				{@const name = t(item.nameKey)}
				{@const isActive = router.location === item.href}
				{#if !uiStore.sidebarOpen}
					{@render TooltipLink(item, name, isActive)}
				{:else}
					{@render NavLink(item, name, isActive)}
				{/if}
			{/each}
		</div>

		<div
			class={cn(
				'space-y-1 border-t pt-2 transition-colors',
				uiStore.sidebarOpen ? 'border-sidebar-border' : 'border-transparent',
			)}
		>
			{#if !uiStore.sidebarOpen}
				{@render TooltipButton(Activity, t('activityCenter.openActivity'), (e: MouseEvent) => { activityStore.setIsOpen(true); (e.currentTarget as HTMLButtonElement).blur(); }, 'activityCenter.title', true)}
			{:else}
				{@render NavButton(Activity, t('activityCenter.openActivity'), () => activityStore.setIsOpen(true), 'activityCenter.title', {}, true)}
			{/if}

			{#each bottomNavigation as item}
				{@const name = t(item.nameKey)}
				{@const isActive = router.location === item.href}
				{#if !uiStore.sidebarOpen}
					{@render TooltipLink(item, name, isActive)}
				{:else}
					{@render NavLink(item, name, isActive)}
				{/if}
			{/each}
		</div>
	</nav>
</aside>
