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
	action: () => void,
	requiresReload = false,
) {
	action();
	if (requiresReload) {
		showReloadDialog = true;
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

<div class="space-y-6">
	<!-- Theme & Styling -->
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
						onclick={() => handleSettingChange(() => themeStore.setTheme(defaultTheme))}
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
							handleSettingChange(() => themeStore.setTheme(val as Theme));
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
						onclick={() => handleSettingChange(() => animationStore.setAnimationsEnabled(defaultAnimation))}
						aria-label={t('appearanceSettings.resetAnimations')}
						aria-hidden={animationStore.animationsEnabled === defaultAnimation}
						tabindex={animationStore.animationsEnabled === defaultAnimation ? -1 : 0}
					>
						<RotateCcw class="size-4" />
					</Button>
					<Switch
						id="animations-toggle"
						checked={animationStore.animationsEnabled}
						onCheckedChange={() => handleSettingChange(() => animationStore.setAnimationsEnabled(!animationStore.animationsEnabled))}
					/>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Toast Notifications -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{t('appearanceSettings.toastNotifications')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-6">
			<div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
				<div class="space-y-1 flex-1">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<label
									{...props}
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

				<div class="flex items-center gap-4 shrink-0">
					<!-- Reset Button -->
					<Button
						variant="ghost"
						size="icon"
						class={cn('size-8 text-muted-foreground', {
							invisible: uiStore.toastPosition === 'top-right',
						})}
						onclick={() => {
							handleSettingChange(() => uiStore.setToastPosition('top-right'));
							toast.success(t('appearanceSettings.settingUpdated', { label: t('appearanceSettings.toastPosition') }));
						}}
						aria-label={t('appearanceSettings.resetToastPosition')}
						aria-hidden={uiStore.toastPosition === 'top-right'}
						tabindex={uiStore.toastPosition === 'top-right' ? -1 : 0}
					>
						<RotateCcw class="size-4" />
					</Button>
					
					<!-- Visual Placement Grid -->
					<div class="relative border border-border/80 rounded-xl bg-muted p-2 shadow-xs select-none w-48 aspect-[1.8/1] flex flex-col justify-between shrink-0">
						<!-- Grid Positions -->
						<!-- Top row -->
						<div class="flex justify-between items-start">
							<!-- Top Left -->
							<button
								type="button"
								onclick={() => {
									handleSettingChange(() => uiStore.setToastPosition('top-left'));
									toast.success(t('appearanceSettings.settingUpdated', { label: t('appearanceSettings.toastPosition') }));
								}}
								class={cn(
									"w-10 h-6 rounded-xs border flex items-center justify-center text-[8px] transition-all duration-150 cursor-pointer font-bold",
									uiStore.toastPosition === 'top-left'
										? "bg-primary border-primary text-primary-foreground shadow-xs"
										: "bg-card border-border hover:bg-accent text-muted-foreground"
								)}
								title={t('appearanceSettings.topLeft')}
							>
								TL
							</button>

							<!-- Top Center -->
							<button
								type="button"
								onclick={() => {
									handleSettingChange(() => uiStore.setToastPosition('top-center'));
									toast.success(t('appearanceSettings.settingUpdated', { label: t('appearanceSettings.toastPosition') }));
								}}
								class={cn(
									"w-10 h-6 rounded-xs border flex items-center justify-center text-[8px] transition-all duration-150 cursor-pointer font-bold",
									uiStore.toastPosition === 'top-center'
										? "bg-primary border-primary text-primary-foreground shadow-xs"
										: "bg-card border-border hover:bg-accent text-muted-foreground"
								)}
								title={t('appearanceSettings.topCenter')}
							>
								TC
							</button>

							<!-- Top Right -->
							<button
								type="button"
								onclick={() => {
									handleSettingChange(() => uiStore.setToastPosition('top-right'));
									toast.success(t('appearanceSettings.settingUpdated', { label: t('appearanceSettings.toastPosition') }));
								}}
								class={cn(
									"w-10 h-6 rounded-xs border flex items-center justify-center text-[8px] transition-all duration-150 cursor-pointer font-bold",
									uiStore.toastPosition === 'top-right'
										? "bg-primary border-primary text-primary-foreground shadow-xs"
										: "bg-card border-border hover:bg-accent text-muted-foreground"
								)}
								title={t('appearanceSettings.topRight')}
							>
								TR
							</button>
						</div>

						<!-- Bottom row -->
						<div class="flex justify-between items-end">
							<!-- Bottom Left -->
							<button
								type="button"
								onclick={() => {
									handleSettingChange(() => uiStore.setToastPosition('bottom-left'));
									toast.success(t('appearanceSettings.settingUpdated', { label: t('appearanceSettings.toastPosition') }));
								}}
								class={cn(
									"w-10 h-6 rounded-xs border flex items-center justify-center text-[8px] transition-all duration-150 cursor-pointer font-bold",
									uiStore.toastPosition === 'bottom-left'
										? "bg-primary border-primary text-primary-foreground shadow-xs"
										: "bg-card border-border hover:bg-accent text-muted-foreground"
								)}
								title={t('appearanceSettings.bottomLeft')}
							>
								BL
							</button>

							<!-- Bottom Center -->
							<button
								type="button"
								onclick={() => {
									handleSettingChange(() => uiStore.setToastPosition('bottom-center'));
									toast.success(t('appearanceSettings.settingUpdated', { label: t('appearanceSettings.toastPosition') }));
								}}
								class={cn(
									"w-10 h-6 rounded-xs border flex items-center justify-center text-[8px] transition-all duration-150 cursor-pointer font-bold",
									uiStore.toastPosition === 'bottom-center'
										? "bg-primary border-primary text-primary-foreground shadow-xs"
										: "bg-card border-border hover:bg-accent text-muted-foreground"
								)}
								title={t('appearanceSettings.bottomCenter')}
							>
								BC
							</button>

							<!-- Bottom Right -->
							<button
								type="button"
								onclick={() => {
									handleSettingChange(() => uiStore.setToastPosition('bottom-right'));
									toast.success(t('appearanceSettings.settingUpdated', { label: t('appearanceSettings.toastPosition') }));
								}}
								class={cn(
									"w-10 h-6 rounded-xs border flex items-center justify-center text-[8px] transition-all duration-150 cursor-pointer font-bold",
									uiStore.toastPosition === 'bottom-right'
										? "bg-primary border-primary text-primary-foreground shadow-xs"
										: "bg-card border-border hover:bg-accent text-muted-foreground"
								)}
								title={t('appearanceSettings.bottomRight')}
							>
								BR
							</button>
						</div>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Window Settings -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{t('appearanceSettings.windowSettings')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-6">
			<div class="space-y-4">
				<!-- Titlebar Style -->
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<label
										{...props}
										for="titlebar-style"
										class="text-sm font-medium inline-flex items-center gap-1.5 cursor-help"
									>
										{t('appearanceSettings.titlebarStyle')}
										<Info class="size-3.5 text-muted-foreground/70" />
									</label>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="top" align="center">
								<p>{t('appearanceSettings.selectTitlebarStyle')}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</div>
					<div class="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							class={cn('size-8 text-muted-foreground', {
								invisible: uiStore.titlebarStyle === 'custom',
							})}
							onclick={() => {
								handleSettingChange(() => uiStore.setTitlebarStyle('custom'));
							}}
							aria-label={t('appearanceSettings.resetTitlebarStyle')}
							aria-hidden={uiStore.titlebarStyle === 'custom'}
							tabindex={uiStore.titlebarStyle === 'custom' ? -1 : 0}
						>
							<RotateCcw class="size-4" />
						</Button>
						<Select.Root
							type="single"
							value={uiStore.titlebarStyle}
							onValueChange={(val) => {
								handleSettingChange(() => uiStore.setTitlebarStyle(val as 'native' | 'custom'));
							}}
						>
							<Select.Trigger id="titlebar-style" class="h-9 w-40">
								{uiStore.titlebarStyle === 'custom' ? t('appearanceSettings.customTitlebar') : t('appearanceSettings.nativeTitlebar')}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="custom">{t('appearanceSettings.customTitlebar')}</Select.Item>
								<Select.Item value="native">{t('appearanceSettings.nativeTitlebar')}</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<!-- Controls Style Override -->
				<div class="ml-6 flex items-center justify-between border-l pl-4">
					<div class="space-y-0.5">
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<label
										{...props}
										for="controls-style"
										class={cn(
											'text-sm font-medium inline-flex items-center gap-1.5 cursor-help',
											{
												'text-muted-foreground': uiStore.titlebarStyle !== 'custom',
											},
										)}
									>
										{t('appearanceSettings.controlsStyle')}
										<Info class="size-3.5 text-muted-foreground/70" />
									</label>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="top" align="center">
								<p>{t('appearanceSettings.selectControlsStyle')}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</div>
					<div class="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							class={cn('size-8 text-muted-foreground', {
								invisible: uiStore.controlsStyle === 'system' || uiStore.titlebarStyle !== 'custom',
							})}
							onclick={() => {
								handleSettingChange(() => uiStore.setControlsStyle('system'));
							}}
							aria-label={t('appearanceSettings.resetControlsStyle')}
							disabled={uiStore.titlebarStyle !== 'custom'}
							aria-hidden={uiStore.controlsStyle === 'system' || uiStore.titlebarStyle !== 'custom'}
							tabindex={uiStore.controlsStyle === 'system' || uiStore.titlebarStyle !== 'custom' ? -1 : 0}
						>
							<RotateCcw class="size-4" />
						</Button>
						<Select.Root
							type="single"
							value={uiStore.controlsStyle}
							disabled={uiStore.titlebarStyle !== 'custom'}
							onValueChange={(val) => {
								handleSettingChange(() => uiStore.setControlsStyle(val as 'system' | 'windows' | 'macos' | 'gnome'));
							}}
						>
							<Select.Trigger id="controls-style" class="h-9 w-40">
								{#if uiStore.controlsStyle === 'system'}
									{t('appearanceSettings.matchSystem')}
								{:else if uiStore.controlsStyle === 'windows'}
									{t('appearanceSettings.windowsStyle')}
								{:else}
									{uiStore.controlsStyle === 'macos' ? t('appearanceSettings.macosStyle') : t('appearanceSettings.gnomeStyle')}
								{/if}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="system">{t('appearanceSettings.matchSystem')}</Select.Item>
								<Select.Item value="windows">{t('appearanceSettings.windowsStyle')}</Select.Item>
								<Select.Item value="macos">{t('appearanceSettings.macosStyle')}</Select.Item>
								<Select.Item value="gnome">{t('appearanceSettings.gnomeStyle')}</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<!-- Controls Alignment -->
				<div class="ml-6 flex items-center justify-between border-l pl-4">
					<div class="space-y-0.5">
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<label
										{...props}
										for="controls-alignment"
										class={cn(
											'text-sm font-medium inline-flex items-center gap-1.5 cursor-help',
											{
												'text-muted-foreground': uiStore.titlebarStyle !== 'custom',
											},
										)}
									>
										{t('appearanceSettings.controlsAlignment')}
										<Info class="size-3.5 text-muted-foreground/70" />
									</label>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="top" align="center">
								<p>{t('appearanceSettings.selectControlsAlignment')}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</div>
					<div class="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							class={cn('size-8 text-muted-foreground', {
								invisible: uiStore.controlsAlignment === 'system' || uiStore.titlebarStyle !== 'custom',
							})}
							onclick={() => {
								handleSettingChange(() => uiStore.setControlsAlignment('system'));
							}}
							aria-label={t('appearanceSettings.resetControlsAlignment')}
							disabled={uiStore.titlebarStyle !== 'custom'}
							aria-hidden={uiStore.controlsAlignment === 'system' || uiStore.titlebarStyle !== 'custom'}
							tabindex={uiStore.controlsAlignment === 'system' || uiStore.titlebarStyle !== 'custom' ? -1 : 0}
						>
							<RotateCcw class="size-4" />
						</Button>
						<Select.Root
							type="single"
							value={uiStore.controlsAlignment}
							disabled={uiStore.titlebarStyle !== 'custom'}
							onValueChange={(val) => {
								handleSettingChange(() => uiStore.setControlsAlignment(val as 'system' | 'left' | 'right'));
							}}
						>
							<Select.Trigger id="controls-alignment" class="h-9 w-40">
								{#if uiStore.controlsAlignment === 'system'}
									{t('appearanceSettings.systemAlignment')}
								{:else}
									{uiStore.controlsAlignment === 'left' ? t('appearanceSettings.leftAlignment') : t('appearanceSettings.rightAlignment')}
								{/if}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="system">{t('appearanceSettings.systemAlignment')}</Select.Item>
								<Select.Item value="left">{t('appearanceSettings.leftAlignment')}</Select.Item>
								<Select.Item value="right">{t('appearanceSettings.rightAlignment')}</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>

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
