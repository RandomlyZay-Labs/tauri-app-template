<!-- SPDX-License-Identifier: MIT -->
<script lang="ts">
import { onMount, onDestroy } from 'svelte';

let isHovered = $state(false);
let isAltPressed = $state(false);
let windowInstance = $state<any>(null);
let cleanups: (() => void)[] = [];

onMount(async () => {
	try {
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		windowInstance = getCurrentWindow();

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Alt') isAltPressed = true;
		};
		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === 'Alt') isAltPressed = false;
		};

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		cleanups.push(() => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		});
	} catch (e) {
		console.error('macOS controls mount fail:', e);
	}
});

onDestroy(() => {
	for (const cleanup of cleanups) cleanup();
});

function handleClose() {
	if (windowInstance) void windowInstance.close();
}

function handleMinimize() {
	if (windowInstance) void windowInstance.minimize();
}

async function handleGreen() {
	if (!windowInstance) return;
	if (isAltPressed) {
		void windowInstance.toggleMaximize();
	} else {
		const fullscreen = await windowInstance.isFullscreen();
		void windowInstance.setFullscreen(!fullscreen);
	}
}
</script>

<div
	role="none"
	class="flex items-center space-x-2 px-3 select-none"
	onmouseenter={() => isHovered = true}
	onmouseleave={() => isHovered = false}
>
	<!-- Close -->
	<button
		onclick={handleClose}
		type="button"
		class="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black/10 bg-[#ff5f56] text-neutral-800 focus:outline-none dark:border-none"
		aria-label="Close"
	>
		{#if isHovered}
			<svg class="h-1.5 w-1.5" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M1 1L5 5M5 1L1 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
			</svg>
		{/if}
	</button>

	<!-- Minimize -->
	<button
		onclick={handleMinimize}
		type="button"
		class="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black/10 bg-[#ffbd2e] text-neutral-800 focus:outline-none dark:border-none"
		aria-label="Minimize"
	>
		{#if isHovered}
			<svg class="h-1.5 w-1.5" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M0.5 3H5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
			</svg>
		{/if}
	</button>

	<!-- Fullscreen / Zoom -->
	<button
		onclick={handleGreen}
		type="button"
		class="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black/10 bg-[#27c93f] text-neutral-800 focus:outline-none dark:border-none"
		aria-label="Maximize"
	>
		{#if isHovered}
			{#if isAltPressed}
				<!-- Plus (Maximize) -->
				<svg class="h-1.5 w-1.5" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M3 0.5V5.5M0.5 3H5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
				</svg>
			{:else}
				<!-- Arrows (Fullscreen) -->
				<svg class="h-1.5 w-1.5" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M1 5L2 4M5 1L4 2M1 5H3.5M1 5V2.5M5 1H2.5M5 1V3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
				</svg>
			{/if}
		{/if}
	</button>
</div>
