<script lang="ts">
import { onMount, onDestroy } from 'svelte';

let isMaximized = $state(false);
let windowInstance = $state<any>(null);
let cleanups: (() => void)[] = [];

onMount(async () => {
	try {
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		windowInstance = getCurrentWindow();
		isMaximized = await windowInstance.isMaximized();

		const unlisten = await windowInstance.onResized(async () => {
			isMaximized = await windowInstance.isMaximized();
		});

		cleanups.push(() => {
			unlisten();
		});
	} catch (e) {
		console.error('GNOME controls mount fail:', e);
	}
});

onDestroy(() => {
	for (const cleanup of cleanups) cleanup();
});

function handleMinimize() {
	if (windowInstance) void windowInstance.minimize();
}

function handleMaximize() {
	if (windowInstance) void windowInstance.toggleMaximize();
}

function handleClose() {
	if (windowInstance) void windowInstance.close();
}
</script>

<div class="flex items-center space-x-2.5 px-3 select-none">
	<!-- Minimize -->
	<button
		onclick={handleMinimize}
		type="button"
		class="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-muted-foreground/20 text-foreground hover:bg-muted-foreground/35 active:bg-muted-foreground/50 focus:outline-none transition-colors"
		aria-label="Minimize"
	>
		<svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M1 4.5H7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
		</svg>
	</button>

	<!-- Maximize -->
	<button
		onclick={handleMaximize}
		type="button"
		class="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-muted-foreground/20 text-foreground hover:bg-muted-foreground/35 active:bg-muted-foreground/50 focus:outline-none transition-colors"
		aria-label={isMaximized ? "Restore" : "Maximize"}
	>
		{#if isMaximized}
			<svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect x="1.5" y="2.5" width="4" height="4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
				<path d="M2.5 1.5H6.5V5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
			</svg>
		{:else}
			<svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect x="1.5" y="1.5" width="5" height="5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
			</svg>
		{/if}
	</button>

	<!-- Close -->
	<button
		onclick={handleClose}
		type="button"
		class="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-muted-foreground/20 text-foreground hover:bg-[#e81123] hover:text-white active:bg-[#f1707a] focus:outline-none transition-colors"
		aria-label="Close"
	>
		<svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
		</svg>
	</button>
</div>
