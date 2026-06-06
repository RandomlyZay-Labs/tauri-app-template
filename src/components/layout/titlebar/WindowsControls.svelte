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

		// Listen for resize to update maximized state
		const unlisten = await windowInstance.onResized(async () => {
			isMaximized = await windowInstance.isMaximized();
		});

		cleanups.push(() => {
			unlisten();
		});
	} catch (e) {
		console.error('Failed to initialize Windows window controls:', e);
	}
});

onDestroy(() => {
	for (const cleanup of cleanups) cleanup();
});

function handleMinimize() {
	if (windowInstance) {
		void windowInstance.minimize();
	}
}

function handleMaximize() {
	if (windowInstance) {
		void windowInstance.toggleMaximize();
	}
}

function handleClose() {
	if (windowInstance) {
		void windowInstance.close();
	}
}
</script>

<div class="flex h-8 select-none items-center">
	<!-- Minimize Button -->
	<button
		onclick={handleMinimize}
		type="button"
		class="inline-flex h-8 w-[46px] items-center justify-center bg-transparent text-foreground hover:bg-muted-foreground/10 active:bg-muted-foreground/20 focus:outline-none transition-colors"
		aria-label="Minimize"
	>
		<svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M0 0.5H10" stroke="currentColor" stroke-width="1"/>
		</svg>
	</button>

	<!-- Maximize / Restore Button -->
	<button
		onclick={handleMaximize}
		type="button"
		class="inline-flex h-8 w-[46px] items-center justify-center bg-transparent text-foreground hover:bg-muted-foreground/10 active:bg-muted-foreground/20 focus:outline-none transition-colors"
		aria-label={isMaximized ? "Restore" : "Maximize"}
	>
		{#if isMaximized}
			<!-- Restore Icon (Double square) -->
			<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M1.5 3.5V1.5H7.5V7.5H5.5" stroke="currentColor" stroke-width="1"/>
				<rect x="3.5" y="3.5" width="5" height="5" stroke="currentColor" stroke-width="1"/>
			</svg>
		{:else}
			<!-- Maximize Icon (Single square) -->
			<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" stroke-width="1"/>
			</svg>
		{/if}
	</button>

	<!-- Close Button -->
	<button
		onclick={handleClose}
		type="button"
		class="inline-flex h-8 w-[46px] items-center justify-center bg-transparent text-foreground hover:bg-[#e81123] hover:text-white active:bg-[#f1707a] focus:outline-none transition-colors"
		aria-label="Close"
	>
		<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1"/>
		</svg>
	</button>
</div>
