<script lang="ts">
import { onMount } from 'svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import WindowControls from './WindowControls.svelte';

let { children } = $props<{ children?: import('svelte').Snippet }>();
let detectedOS = $state<'windows' | 'macos' | 'gnome'>('windows');
let windowInstance = $state<any>(null);

onMount(async () => {
	try {
		const { type } = await import('@tauri-apps/plugin-os');
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		windowInstance = getCurrentWindow();
		const osName = type();
		if (osName === 'macos') {
			detectedOS = 'macos';
		} else if (osName === 'linux') {
			detectedOS = 'gnome';
		} else {
			detectedOS = 'windows';
		}
	} catch (e) {
		console.error('Titlebar mount fail:', e);
	}
});

const isControlsLeft = $derived.by(() => {
	if (uiStore.controlsAlignment === 'left') return true;
	if (uiStore.controlsAlignment === 'right') return false;
	// system default: macOS is left-aligned controls, Windows/Linux are right-aligned
	return detectedOS === 'macos';
});

function handleDoubleClick() {
	if (windowInstance) {
		void windowInstance.toggleMaximize();
	}
}
</script>

{#if uiStore.titlebarStyle === 'custom' && !uiStore.isFullscreen}
	<div
		role="none"
		class="flex h-8 w-full select-none items-center border-b border-sidebar-border bg-sidebar/95 px-2 text-sidebar-foreground backdrop-blur-xl"
		data-tauri-drag-region
		ondblclick={handleDoubleClick}
	>
		{#if isControlsLeft}
			<WindowControls />
			<div class="flex flex-1 items-center justify-center pr-[90px]" data-tauri-drag-region>
				{@render children?.()}
			</div>
		{:else}
			<div class="flex flex-1 items-center justify-center pl-[90px]" data-tauri-drag-region>
				{@render children?.()}
			</div>
			<WindowControls />
		{/if}
	</div>
{/if}
