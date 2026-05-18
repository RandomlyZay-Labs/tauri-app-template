import { invoke } from '@tauri-apps/api/core';
import { uiStore } from '@/stores/uiStore.svelte';

export let telemetryInitialized = false;

/**
 * Marks telemetry as initialized once the UI store has hydrated.
 * Unlike the posthog-js version, no SDK needs to be "started" — the
 * Rust plugin is always ready.  We just gate on hydration so the
 * consent flag has been read from persistent storage.
 */
export function initTelemetry() {
	if (telemetryInitialized || !uiStore._hasHydrated) return;
	telemetryInitialized = true;
}

export function captureEvent(
	event: string,
	properties?: Record<string, unknown>,
) {
	if (!uiStore.telemetryEnabled || !telemetryInitialized) return;
	void invoke('plugin:better-posthog|capture', { event, properties });
}

/**
 * Consent is stored in the UI store. No SDK-level opt-in/out is needed
 * because we simply don't invoke the plugin when disabled.
 */
export function updateTelemetryConsent(enabled: boolean) {
	if (!telemetryInitialized) return;
	if (enabled) {
		captureEvent('telemetry_opted_in');
	}
}
