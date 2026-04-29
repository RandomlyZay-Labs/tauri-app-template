import posthog from 'posthog-js';
import { uiStore } from '@/stores/uiStore.svelte';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST =
	import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let isInitialized = false;

/**
 * Initializes PostHog only after the UI store has fully hydrated from
 * persistent storage. This prevents the race condition where autocapture
 * fires before we can read the user's consent state.
 *
 * Must be called from a reactive Svelte context (e.g. inside $effect) so
 * that it re-evaluates once `uiStore._hasHydrated` becomes true.
 */
export function initTelemetry() {
	if (isInitialized || !POSTHOG_KEY || !uiStore._hasHydrated) return;

	posthog.init(POSTHOG_KEY, {
		api_host: POSTHOG_HOST,
		autocapture: true,
		capture_pageview: true,
		capture_pageleave: true,
		disable_session_recording: true,
		loaded: (ph) => {
			if (!uiStore.telemetryEnabled) {
				ph.opt_out_capturing();
			}
		},
	});

	isInitialized = true;
}

export function captureEvent(
	event: string,
	properties?: Record<string, unknown>,
) {
	if (uiStore.telemetryEnabled && isInitialized) {
		posthog.capture(event, properties);
	}
}

export function updateTelemetryConsent(enabled: boolean) {
	if (!isInitialized) return;

	if (enabled) {
		posthog.opt_in_capturing();
	} else {
		posthog.opt_out_capturing();
	}
}
