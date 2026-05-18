import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

vi.mock('@/stores/uiStore.svelte', () => ({
	uiStore: {
		telemetryEnabled: true,
		_hasHydrated: true,
	},
}));

describe('telemetry', () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.clearAllMocks();
		const uiStoreMod = await import('@/stores/uiStore.svelte');
		uiStoreMod.uiStore.telemetryEnabled = true;
		uiStoreMod.uiStore._hasHydrated = true;
	});

	it('initializes telemetry correctly', async () => {
		const telemetry = await import('./telemetry');
		expect(telemetry.telemetryInitialized).toBe(false);
		telemetry.initTelemetry();
		expect(telemetry.telemetryInitialized).toBe(true);
	});

	it('captures events if enabled and initialized', async () => {
		const { initTelemetry, captureEvent } = await import('./telemetry');
		const { invoke } = await import('@tauri-apps/api/core');
		initTelemetry();
		captureEvent('test_event', { foo: 'bar' });

		expect(invoke).toHaveBeenCalledWith('plugin:better-posthog|capture', {
			event: 'test_event',
			properties: { foo: 'bar' },
		});
	});

	it('does not capture events if not initialized', async () => {
		const { captureEvent } = await import('./telemetry');
		const { invoke } = await import('@tauri-apps/api/core');
		captureEvent('test_event', { foo: 'bar' });

		expect(invoke).not.toHaveBeenCalled();
	});

	it('does not capture events if uiStore.telemetryEnabled is false', async () => {
		const uiStoreMod = await import('@/stores/uiStore.svelte');
		uiStoreMod.uiStore.telemetryEnabled = false;

		const { initTelemetry, captureEvent } = await import('./telemetry');
		const { invoke } = await import('@tauri-apps/api/core');
		initTelemetry();
		captureEvent('test_event', { foo: 'bar' });

		expect(invoke).not.toHaveBeenCalled();
	});

	it('updates telemetry consent with opt-in event', async () => {
		const { initTelemetry, updateTelemetryConsent } = await import(
			'./telemetry'
		);
		const { invoke } = await import('@tauri-apps/api/core');
		initTelemetry();

		updateTelemetryConsent(true);
		expect(invoke).toHaveBeenCalledWith('plugin:better-posthog|capture', {
			event: 'telemetry_opted_in',
			properties: undefined,
		});

		vi.clearAllMocks();
		updateTelemetryConsent(false);
		expect(invoke).not.toHaveBeenCalled();
	});
});
