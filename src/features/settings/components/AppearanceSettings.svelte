<script lang="ts">
import * as Tooltip from '@/components/ui/tooltip';
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { cn, getSystemAnimationPreference } from '@/lib/utils';
import { animationStore } from '@/stores/animationStore.svelte';
import { THEME_OPTIONS, type Theme, themeStore } from '@/stores/themeStore.svelte';
import { uiStore, type ToastPosition } from '@/stores/uiStore.svelte';
import { Info, RotateCcw } from '@lucide/svelte';

import { Button } from '@/components/ui/button';
import * as Card from '@/components/ui/card';
import * as Dialog from '@/components/ui/dialog';
import * as Select from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

let showReloadDialog = $state(false);

const defaultTheme: Theme = 'system';
const defaultAnimation = getSystemAnimationPreference();

function handleSettingChange(
	label: string,
	action: () => void,
	requiresReload = false,
) {
	action();
	if (requiresReload) {
		showReloadDialog = true;
	} else {
		toast.success(t('appearanceSettings.settingUpdated', { label }));
	}
}

function getToastPositionLabelKey(pos: string): string {
	if (!pos) return '';
	const parts = pos.split('-');
	const camelCase = parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
	return `appearanceSettings.${camelCase}`;
}

// Reference keys statically to satisfy the i18n test checking for unused translation keys
const _unusedKeysDummy = [
	t('appearanceSettings.topLeft'),
	t('appearanceSettings.topCenter'),
	t('appearanceSettings.topRight'),
	t('appearanceSettings.bottomLeft'),
	t('appearanceSettings.bottomCenter'),
	t('appearanceSettings.bottomRight'),
];
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{t('appearanceSettings.title')}</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-6">
		<!-- Theme Mode -->
		<div class="flex items-center justify-between">
			<div class="space-y-0.5">
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<label
								{...props}
								for="theme-mode"
								class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
							>
								{t('appearanceSettings.themeMode')}
								<Info class="size-3.5 text-muted-foreground/70" />
							</label>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top" align="center">
						<p>{t('appearanceSettings.selectTheme')}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					class={cn('size-8 text-muted-foreground', {
						invisible: themeStore.theme === defaultTheme,
					})}
					onclick={() => handleSettingChange(t('appearanceSettings.themeMode'), () => themeStore.setTheme(defaultTheme))}
					aria-label={t('appearanceSettings.resetThemeMode')}
					aria-hidden={themeStore.theme === defaultTheme}
					tabindex={themeStore.theme === defaultTheme ? -1 : 0}
				>
					<RotateCcw class="size-4" />
				</Button>
				<Select.Root
					type="single"
					value={themeStore.theme}
					onValueChange={(val) => {
						handleSettingChange(t('appearanceSettings.themeMode'), () => themeStore.setTheme(val as Theme));
					}}
				>
					<Select.Trigger id="theme-mode" class="h-9 w-40 capitalize">
						{t(THEME_OPTIONS.find((o) => o.value === themeStore.theme)?.labelKey ?? '')}
					</Select.Trigger>
					<Select.Content>
						{#each THEME_OPTIONS as opt (opt.value)}
							<Select.Item value={opt.value} class="capitalize">{t(opt.labelKey)}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<div class="h-px bg-border"></div>

		<!-- Animations -->
		<div class="flex items-center justify-between">
			<div class="space-y-0.5">
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<label
								{...props}
								for="animations-toggle"
								class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
							>
								{t('appearanceSettings.animations')}
								<Info class="size-3.5 text-muted-foreground/70" />
							</label>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top" align="center">
						<p>{t('appearanceSettings.animationsDescription')}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					class={cn('size-8 text-muted-foreground', {
						invisible: animationStore.animationsEnabled === defaultAnimation,
					})}
					onclick={() => handleSettingChange(t('appearanceSettings.animations'), () => animationStore.setAnimationsEnabled(defaultAnimation))}
					aria-label={t('appearanceSettings.resetAnimations')}
					aria-hidden={animationStore.animationsEnabled === defaultAnimation}
					tabindex={animationStore.animationsEnabled === defaultAnimation ? -1 : 0}
				>
					<RotateCcw class="size-4" />
				</Button>
				<Switch
					id="animations-toggle"
					checked={animationStore.animationsEnabled}
					onCheckedChange={() => handleSettingChange(t('appearanceSettings.animations'), () => animationStore.setAnimationsEnabled(!animationStore.animationsEnabled))}
				/>
			</div>
		</div>

		<div class="h-px bg-border"></div>

		<!-- Toast Position -->
		<div class="flex items-center justify-between">
			<div class="space-y-0.5">
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<label
								{...props}
								for="toast-position"
								class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
							>
								{t('appearanceSettings.toastPosition')}
								<Info class="size-3.5 text-muted-foreground/70" />
							</label>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="top" align="center">
						<p>{t('appearanceSettings.toastPositionDescription')}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					class={cn('size-8 text-muted-foreground', {
						invisible: uiStore.toastPosition === 'top-right',
					})}
					onclick={() => handleSettingChange(t('appearanceSettings.toastPosition'), () => uiStore.setToastPosition('top-right'))}
					aria-label={t('appearanceSettings.resetToastPosition')}
					aria-hidden={uiStore.toastPosition === 'top-right'}
					tabindex={uiStore.toastPosition === 'top-right' ? -1 : 0}
				>
					<RotateCcw class="size-4" />
				</Button>
				<Select.Root
					type="single"
					value={uiStore.toastPosition}
					onValueChange={(val) => {
						handleSettingChange(t('appearanceSettings.toastPosition'), () => uiStore.setToastPosition(val as ToastPosition));
					}}
				>
					<Select.Trigger id="toast-position" class="h-9 w-40 capitalize">
						{t(getToastPositionLabelKey(uiStore.toastPosition))}
					</Select.Trigger>
					<Select.Content>
						{#each ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as pos}
							<Select.Item value={pos} class="capitalize">
								{t(getToastPositionLabelKey(pos))}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>
	</Card.Content>
</Card.Root>

<Dialog.Root bind:open={showReloadDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{t('appearanceSettings.restartRequired')}</Dialog.Title>
			<Dialog.Description>{t('appearanceSettings.restartDescription')}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showReloadDialog = false)}>{t('appearanceSettings.later')}</Button>
			<Button onclick={() => window.location.reload()}>{t('appearanceSettings.restartNow')}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
