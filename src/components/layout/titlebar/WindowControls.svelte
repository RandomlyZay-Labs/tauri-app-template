<script lang="ts">
import { onMount } from 'svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import WindowsControls from './WindowsControls.svelte';
import MacOsControls from './MacOSControls.svelte';
import GnomeControls from './GnomeControls.svelte';

let detectedOS = $state<'windows' | 'macos' | 'gnome'>('windows');

onMount(async () => {
	try {
		const { type } = await import('@tauri-apps/plugin-os');
		const osName = type();
		if (osName === 'macos') {
			detectedOS = 'macos';
		} else if (osName === 'linux') {
			detectedOS = 'gnome';
		} else {
			detectedOS = 'windows';
		}
	} catch (e) {
		console.error('OS detection failed:', e);
	}
});

const currentStyle = $derived.by(() => {
	if (uiStore.controlsStyle && uiStore.controlsStyle !== 'system') {
		return uiStore.controlsStyle;
	}
	return detectedOS;
});
</script>

{#if currentStyle === 'macos'}
	<MacOsControls />
{:else if currentStyle === 'gnome'}
	<GnomeControls />
{:else}
	<WindowsControls />
{/if}
