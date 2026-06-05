<script lang="ts">
import AppLayout from '@/components/layout/AppLayout.svelte';
import { Button } from '@/components/ui/button';
import { getAppVersion } from '@/lib/app-version.svelte';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { openExternalLink } from '@/lib/system-utils';
import { animationStore } from '@/stores/animationStore.svelte';
import { ExternalLink } from '@lucide/svelte';
import { fade } from 'svelte/transition';
import { Badge } from '@/components/ui/badge';
import { onDestroy } from 'svelte';

function openLink(url: string) {
	void executeSafeAction(() => openExternalLink(url), {
		errorMessage: t('about.failedToOpenLink'),
	});
}

const appVersion = $derived(getAppVersion());

let fillLevel = $state(0);
let isFullyFilled = $state(false);
let heartBeating = $state(false);
let floatingHearts = $state<{
	id: number;
	startX: number;
	startY: number;
	driftX: string;
	driftY: string;
	rotation: string;
	scale: number;
	delay: number;
}[]>([]);
let cursorParticles = $state<{
	id: number;
	x: number;
	y: number;
	size: number;
	mx: string;
	my: string;
	rot: string;
}[]>([]);
let heartIdCounter = $state(0);
let particleIdCounter = 0;
let mouseX = $state(50);
let mouseY = $state(50);
let lastX = 0;
let lastY = 0;
let drainInterval: ReturnType<typeof setInterval> | undefined;
let bounceTimeout: ReturnType<typeof setTimeout> | undefined;
let activeTimeouts: ReturnType<typeof setTimeout>[] = [];

function startDraining() {
	if (drainInterval || isFullyFilled) return;
	drainInterval = setInterval(() => {
		if (isFullyFilled) {
			if (drainInterval) clearInterval(drainInterval);
			return;
		}
		if (fillLevel > 0) {
			fillLevel = Math.max(0, fillLevel - 1.2);
		}
	}, 100);
}

function spawnLaunchHearts() {
	if (!isFullyFilled || !animationStore.animationsEnabled) return;
	const buttonEl = document.querySelector('.about-heart-container');
	if (!buttonEl) return;
	
	const rect = buttonEl.getBoundingClientRect();
	const startX = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
	const startY = ((rect.top + rect.height / 2) / window.innerHeight) * 100;

	// Emit 8 hearts in a circular ring burst
	const burstHearts = Array.from({ length: 8 }, (_, i) => {
		const angle = (i * 2 * Math.PI) / 8;
		const speed = 8 + Math.random() * 8; // spread speed in vw/vh
		return {
			id: heartIdCounter++,
			startX,
			startY,
			driftX: `${Math.cos(angle) * speed}vw`,
			driftY: `${Math.sin(angle) * speed - 4}vh`, // drift slightly up
			rotation: `${(Math.random() - 0.5) * 360}deg`,
			scale: 0.55 + Math.random() * 0.35,
			delay: 0,
		};
	});

	floatingHearts = [...floatingHearts, ...burstHearts];

	const timeoutId = setTimeout(() => {
		floatingHearts = floatingHearts.filter(
			(h) => !burstHearts.some((n) => n.id === h.id),
		);
		activeTimeouts = activeTimeouts.filter((t) => t !== timeoutId);
	}, 2200);
	activeTimeouts.push(timeoutId);
}

function onAnimationIteration() {
	if (!isFullyFilled || !animationStore.animationsEnabled) return;
	// Capture the start of the next CSS animation loop and schedule launch hearts at 66% (2772ms)
	const timeoutId = setTimeout(() => {
		spawnLaunchHearts();
		activeTimeouts = activeTimeouts.filter((t) => t !== timeoutId);
	}, 2772);
	activeTimeouts.push(timeoutId);
}

function onHeartClick() {
	if (isFullyFilled) return;

	// Reset and trigger bounce animation on every single click
	if (bounceTimeout) clearTimeout(bounceTimeout);
	heartBeating = false;
	bounceTimeout = setTimeout(() => {
		heartBeating = true;
	}, 20);

	startDraining();
	fillLevel = Math.min(100, fillLevel + 8);

	if (fillLevel >= 100) {
		isFullyFilled = true;
		if (drainInterval) {
			clearInterval(drainInterval);
			drainInterval = undefined;
		}

		if (animationStore.animationsEnabled) {
			// Confetti burst of 35 hearts spanning the entire screen randomly (like before, but fullscreen overlay)
			const winHearts = Array.from({ length: 35 }, () => ({
				id: heartIdCounter++,
				startX: Math.random() * 100,
				startY: Math.random() * 80 + 10,
				driftX: `${(Math.random() - 0.5) * 15}vw`,
				driftY: `${-15 - Math.random() * 25}vh`,
				rotation: `${(Math.random() - 0.5) * 720}deg`,
				scale: 0.55 + Math.random() * 0.65,
				delay: Math.random() * 0.4,
			}));
			floatingHearts = [...floatingHearts, ...winHearts];

			const winTimeoutId = setTimeout(() => {
				floatingHearts = floatingHearts.filter(
					(h) => !winHearts.some((n) => n.id === h.id),
				);
				activeTimeouts = activeTimeouts.filter((t) => t !== winTimeoutId);
			}, 2500);
			activeTimeouts.push(winTimeoutId);

			// Synchronize circular launch burst for the very first iteration at 66% (2772ms)
			const launchTimeoutId = setTimeout(() => {
				spawnLaunchHearts();
				activeTimeouts = activeTimeouts.filter((t) => t !== launchTimeoutId);
			}, 2772);
			activeTimeouts.push(launchTimeoutId);
		}
		return;
	}

	if (animationStore.animationsEnabled) {
		// Normal floating hearts spawning randomly across the screen (version 1 behavior, spanning full screen)
		const newHearts = Array.from({ length: 6 }, () => ({
			id: heartIdCounter++,
			startX: Math.random() * 100,
			startY: Math.random() * 80 + 10,
			driftX: `${(Math.random() - 0.5) * 12}vw`,
			driftY: `${-10 - Math.random() * 18}vh`,
			rotation: `${(Math.random() - 0.5) * 360}deg`,
			scale: 0.5 + Math.random() * 0.45,
			delay: Math.random() * 0.3,
		}));
		floatingHearts = [...floatingHearts, ...newHearts];

		const heartTimeoutId = setTimeout(() => {
			floatingHearts = floatingHearts.filter(
				(h) => !newHearts.some((n) => n.id === h.id),
			);
			activeTimeouts = activeTimeouts.filter((t) => t !== heartTimeoutId);
		}, 2000);
		activeTimeouts.push(heartTimeoutId);
	}
}

function onMouseMove(e: MouseEvent) {
	const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
	mouseX = ((e.clientX - rect.left) / rect.width) * 100;
	mouseY = ((e.clientY - rect.top) / rect.height) * 100;

	if (!animationStore.animationsEnabled) return;
	
	// Mouse trail particle spawning
	const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);
	if (dist > 15) {
		const newParticle = {
			id: particleIdCounter++,
			x: e.clientX,
			y: e.clientY,
			size: 14 + Math.random() * 10,
			mx: `${(Math.random() - 0.5) * 50}px`,
			my: `${(Math.random() - 0.5) * 50 + 15}px`,
			rot: `${(Math.random() - 0.5) * 360}deg`,
		};
		cursorParticles = [...cursorParticles, newParticle];
		lastX = e.clientX;
		lastY = e.clientY;

		const particleTimeoutId = setTimeout(() => {
			cursorParticles = cursorParticles.filter((p) => p.id !== newParticle.id);
			activeTimeouts = activeTimeouts.filter((t) => t !== particleTimeoutId);
		}, 800);
		activeTimeouts.push(particleTimeoutId);
	}
}

onDestroy(() => {
	if (drainInterval) clearInterval(drainInterval);
	if (bounceTimeout) clearTimeout(bounceTimeout);
	activeTimeouts.forEach(clearTimeout);
});
</script>

{#if animationStore.animationsEnabled}
	<!-- Cursor Particles Overlay -->
	<div class="pointer-events-none fixed inset-0 z-40 overflow-hidden">
		{#each cursorParticles as p (p.id)}
			<div
				class="cursor-particle absolute"
				style="
					left: {p.x}px;
					top: {p.y}px;
					width: {p.size}px;
					height: {p.size}px;
					--mx: {p.mx};
					--my: {p.my};
					--rot: {p.rot};
					transform: translate(-50%, -50%);
				"
				aria-hidden="true"
			>
				{#if isFullyFilled}
					<!-- Heart Particle -->
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						class="h-full w-full fill-pink-500/80 text-pink-400 filter drop-shadow(0 2px 4px oklch(0.63 0.24 345 / 30%))"
						aria-hidden="true"
					>
						<path
							d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{:else}
					<!-- Sparkle Particle -->
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						class="h-full w-full fill-yellow-400 text-yellow-300 filter drop-shadow(0 2px 4px oklch(0.8 0.15 85 / 40%))"
						aria-hidden="true"
					>
						<path
							d="M12 2 L14.8 9.2 L22 12 L14.8 14.8 L12 22 L9.2 14.8 L2 12 L9.2 9.2 Z"
							stroke="currentColor"
							stroke-width="1"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Fullscreen Floating Hearts Overlay -->
	<div class="pointer-events-none fixed inset-0 z-50 overflow-hidden">
		{#each floatingHearts as heart (heart.id)}
			<div
				class="about-floating-heart absolute"
				style="
					left: {heart.startX}%;
					top: {heart.startY}%;
					--drift-x: {heart.driftX};
					--drift-y: {heart.driftY};
					--rotation: {heart.rotation};
					--scale: {heart.scale};
					animation-delay: {heart.delay}s;
				"
				aria-hidden="true"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					class="size-7 fill-pink-500/80 text-pink-400 filter drop-shadow(0 2px 4px oklch(0.63 0.24 345 / 30%))"
					aria-hidden="true"
				>
					<path
						d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>
		{/each}
	</div>
{/if}

<AppLayout>
	<div
		class="about-container relative mx-auto flex min-h-[85vh] w-full max-w-4xl flex-col items-center justify-center overflow-hidden p-6"
		onmousemove={onMouseMove}
		role="presentation"
	>
		<!-- Mouse-follow radial glow (always rendered to track cursor spotlight) -->
		<div
			class="pointer-events-none absolute inset-0 -z-5 transition-opacity duration-500"
			style="background: radial-gradient(600px circle at {mouseX}% {mouseY}%, oklch(0.65 0.2 280 / 6%), transparent 60%);"
			aria-hidden="true"
		></div>

		<!-- Background Decor -->
		<div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" in:fade={{ duration: animationStore.animationsEnabled ? 200 : 0 }}>
			<div class="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-[oklch(0.67_0.18_275/8%)] blur-3xl"></div>
			<div class="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-[oklch(0.55_0.22_290/8%)] blur-3xl"></div>

			<!-- Floating particles -->
			{#if animationStore.animationsEnabled}
				{#each Array(8) as _, i}
					<div
						class="about-particle absolute rounded-full"
						style="
							width: {3 + Math.random() * 4}px;
							height: {3 + Math.random() * 4}px;
							left: {10 + (i * 11)}%;
							top: {15 + Math.random() * 60}%;
							animation-delay: {i * -1.5}s;
							animation-duration: {8 + Math.random() * 6}s;
							opacity: {0.15 + Math.random() * 0.2};
						"
						aria-hidden="true"
					></div>
				{/each}
			{/if}
		</div>

		<div class="z-10 w-full space-y-12 text-center">
			<!-- Header -->
			<div class="animate-page-in relative space-y-6" style="animation-delay: 0s; {animationStore.animationsEnabled ? '' : 'animation: none; opacity: 1;'}">

				<button
					type="button"
					class="about-heart-container group relative mx-auto flex w-fit cursor-pointer items-center justify-center rounded-3xl border-0 bg-linear-to-br from-primary/20 to-primary/5 p-8 shadow-2xl ring-1 ring-primary/20 backdrop-blur-sm transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary {heartBeating ? 'about-heart-burst' : ''}"
					onclick={onHeartClick}
					disabled={isFullyFilled}
					aria-label={t('about.madeWith')}
					style="
						box-shadow: 0 10px 25px -5px oklch(0.63 0.24 345 / {isFullyFilled ? 40 : fillLevel / 3}%), 0 8px 10px -6px oklch(0.63 0.24 345 / {isFullyFilled ? 40 : fillLevel / 3}%);
					"
				>
					{#if !isFullyFilled && animationStore.animationsEnabled}
						<div class="about-heart-pulse-ring absolute inset-0 rounded-3xl" aria-hidden="true"></div>
					{/if}

					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						class="about-heart-icon size-20 transition-all duration-150 {isFullyFilled ? 'about-heart-winner-icon' : 'about-heart-pulse-anim'}"
						onanimationiteration={onAnimationIteration}
						aria-hidden="true"
					>
						<defs>
							<linearGradient id="heartGradient" x1="0" y1="1" x2="0" y2="0">
								<stop offset="{fillLevel}%" stop-color="oklch(0.63 0.24 345)" />
								<stop offset="{fillLevel}%" stop-color="oklch(0.63 0.24 345 / 10%)" />
							</linearGradient>
						</defs>
						<path
							d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
							fill="url(#heartGradient)"
							stroke="oklch(0.63 0.24 345)"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>

				<div class="space-y-2">
					<h1 class="text-gradient-primary pb-2 font-extrabold text-5xl tracking-tight">
						{t('about.title')}
					</h1>
					<p class="mx-auto max-w-lg text-muted-foreground text-xl leading-relaxed">
						{t('about.description')}
					</p>
				</div>
			</div>

			<!-- Ko-fi Button -->
			<div class="animate-page-in flex w-full justify-center" style="animation-delay: 0.1s; {animationStore.animationsEnabled ? '' : 'animation: none; opacity: 1;'}">

				<Button
					type="button"
					variant="default"
					data-testid="kofi-btn"
					class="group flex cursor-pointer items-center gap-3 rounded-full bg-[#72A5F2] h-auto px-8 py-3.5 font-bold text-white shadow-xl ring-4 ring-[#72A5F2]/10 transition-all hover:bg-[#72A5F2]/90 hover:-translate-y-0.5"
					onclick={() => openLink('https://ko-fi.com/randomlyzay')}
				>
					<img
						src="/images/kofi_symbol.svg"
						alt=""
						class="size-7 transition-transform duration-150 group-hover:rotate-12"
						aria-hidden="true"
					/>
					<span class="text-lg tracking-tight">{t('about.supportOnKofi')}</span>
				</Button>
			</div>

			<!-- GitHub & Footer -->
			<div class="animate-page-in space-y-8" style="animation-delay: 0.2s; {animationStore.animationsEnabled ? '' : 'animation: none; opacity: 1;'}">

				<div class="flex justify-center">
					<Button
						type="button"
						variant="ghost"
						data-testid="github-btn"
						class="group flex cursor-pointer items-center gap-2 rounded-full px-6 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
						onclick={() => openLink('https://github.com/RandomlyZay')}
					>
						<svg class="size-5 transition-transform group-hover:rotate-12" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
						<span>{t('about.checkOutProjects')}</span>
						<ExternalLink class="size-3 opacity-50" aria-hidden="true" />
					</Button>
				</div>

				<div class="flex flex-col items-center gap-4">
					<Badge variant="outline" class="flex items-center gap-2 rounded-full border border-border/50 bg-muted/50 px-3 py-1 font-mono text-muted-foreground/70 text-xs h-auto">
						<span>v{appVersion}</span>
						<span class="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
						<span>{t('about.license')}</span>
					</Badge>
					<p class="text-muted-foreground/40 text-xs">{t('about.madeWith')}</p>
				</div>
			</div>
		</div>
	</div>
</AppLayout>

<style>
@keyframes pageIn {
	from {
		opacity: 0;
		transform: translateY(-20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.animate-page-in {
	opacity: 0;
	animation: pageIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* Ambient floating particles */
@keyframes float-drift {
	0%, 100% {
		transform: translateY(0) translateX(0) scale(1);
		opacity: 0.15;
	}
	25% {
		transform: translateY(-30px) translateX(10px) scale(1.2);
		opacity: 0.3;
	}
	50% {
		transform: translateY(-15px) translateX(-8px) scale(0.9);
		opacity: 0.2;
	}
	75% {
		transform: translateY(-40px) translateX(5px) scale(1.1);
		opacity: 0.25;
	}
}

.about-particle {
	background: oklch(0.7 0.15 280);
	animation: float-drift 10s ease-in-out infinite;
}

/* Heart pulse ring */
@keyframes pulse-ring {
	0%, 100% {
		box-shadow: 0 0 0 0 oklch(0.63 0.24 345 / 20%);
	}
	50% {
		box-shadow: 0 0 0 12px oklch(0.63 0.24 345 / 0%);
	}
}

.about-heart-pulse-ring {
	animation: pulse-ring 3s ease-in-out infinite;
}

/* Heart container click bounce */
@keyframes click-bounce {
	0% { transform: scale(1); }
	30% { transform: scale(1.12); }
	55% { transform: scale(0.95); }
	100% { transform: scale(1); }
}

.about-heart-burst {
	animation: click-bounce 0.45s cubic-bezier(0.25, 1, 0.5, 1) forwards;
}

/* Heart icon idle beat */
@keyframes heartbeat {
	0%, 100% { transform: scale(1); }
	14% { transform: scale(1.08); }
	28% { transform: scale(1); }
	42% { transform: scale(1.05); }
	56% { transform: scale(1); }
}

.about-heart-pulse-anim {
	animation: heartbeat 2.5s ease-in-out infinite;
}

/* Fully filled state: Heart icon inside does the Z-axis (2D) jump and counter-clockwise spin continuously */
@keyframes win-2d-jump-spin {
	0%, 55% {
		transform: translateY(0) rotate(0deg) scale(1);
	}
	/* Anticipation (longer squash) */
	66% {
		transform: translateY(4px) rotate(0deg) scaleX(1.35) scaleY(0.65);
		animation-timing-function: cubic-bezier(0.25, 1, 0.50, 1); /* fast launch */
	}
	/* Weightless peak, rotated half way, stretched */
	78% {
		transform: translateY(-55px) rotate(-180deg) scaleX(0.85) scaleY(1.15);
		animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45); /* gravity fall */
	}
	/* Land squash */
	88% {
		transform: translateY(0) rotate(-360deg) scaleX(1.3) scaleY(0.7);
		animation-timing-function: ease-out;
	}
	/* Rebound */
	94% {
		transform: translateY(-6px) rotate(-360deg) scaleX(0.98) scaleY(1.02);
		animation-timing-function: ease-in-out;
	}
	100% {
		transform: translateY(0) rotate(-360deg) scale(1);
	}
}

.about-heart-winner-icon {
	animation: win-2d-jump-spin 4.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
	filter: drop-shadow(0 0 15px oklch(0.63 0.24 345 / 50%));
}

/* Floating hearts from click */
@keyframes float-away {
	0% {
		opacity: 0.8;
		transform: translate(-50%, -50%) scale(1) rotate(0deg);
	}
	100% {
		opacity: 0;
		transform: translate(calc(-50% + var(--drift-x)), calc(-50% + var(--drift-y))) scale(var(--scale)) rotate(var(--rotation));
	}
}

.about-floating-heart {
	opacity: 0; /* Hidden by default until animation delay ends and it starts */
	animation: float-away 2.2s cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
}

/* Cursor trail fade & drift animation */
@keyframes particle-fade-drift {
	0% {
		transform: translate(-50%, -50%) scale(1) rotate(0deg);
		opacity: 1;
	}
	100% {
		transform: translate(calc(-50% + var(--mx)), calc(-50% + var(--my))) scale(0.25) rotate(var(--rot));
		opacity: 0;
	}
}

.cursor-particle {
	pointer-events: none;
	animation: particle-fade-drift 0.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
}

/* Disable all about-page animations when prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
	.about-particle,
	.about-heart-pulse-ring,
	.about-heart-burst,
	.about-heart-pulse-anim,
	.about-heart-winner-icon,
	.about-floating-heart,
	.cursor-particle,
	.animate-page-in {
		animation: none !important;
		opacity: 1 !important;
	}
}
</style>
