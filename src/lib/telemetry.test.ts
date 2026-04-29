import posthog from 'posthog-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('posthog-js', () => ({
	default: {
		init: vi.fn(),
		capture: vi.fn(),
		opt_in_capturing: vi.fn(),
		opt_out_capturing: vi.fn(),
	},
}));

vi.mock('@/stores/uiStore.svelte', () => ({
	uiStore: {
		telemetryEnabled: true,
		_hasHydrated: true,
	},
}));

describe('telemetry', () => {
	beforeEach(() => {
		vi.stubEnv('VITE_POSTHOG_KEY', 'test-key');
		vi.stubEnv('VITE_POSTHOG_HOST', 'https://test.posthog.com');
		vi.resetModules();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('initializes posthog correctly', async () => {
		const { initTelemetry } = await import('./telemetry');
		initTelemetry();

		expect(posthog.init).toHaveBeenCalledWith(
			'test-key',
			expect.objectContaining({
				api_host: 'https://test.posthog.com',
				autocapture: true,
				capture_pageview: true,
			}),
		);
	});

	it('does not initialize if no key is present', async () => {
		vi.stubEnv('VITE_POSTHOG_KEY', '');
		const { initTelemetry } = await import('./telemetry');
		initTelemetry();

		expect(posthog.init).not.toHaveBeenCalled();
	});

	it('captures events if enabled and initialized', async () => {
		const { initTelemetry, captureEvent } = await import('./telemetry');
		initTelemetry();
		captureEvent('test_event', { foo: 'bar' });

		expect(posthog.capture).toHaveBeenCalledWith('test_event', { foo: 'bar' });
	});

	it('does not capture events if not initialized', async () => {
		const { captureEvent } = await import('./telemetry');
		captureEvent('test_event', { foo: 'bar' });

		expect(posthog.capture).not.toHaveBeenCalled();
	});

	it('does not capture events if uiStore.telemetryEnabled is false', async () => {
		const uiStoreMod = await import('@/stores/uiStore.svelte');
		uiStoreMod.uiStore.telemetryEnabled = false;

		const { initTelemetry, captureEvent } = await import('./telemetry');
		initTelemetry();
		captureEvent('test_event', { foo: 'bar' });

		expect(posthog.capture).not.toHaveBeenCalled();
	});

	it('updates telemetry consent', async () => {
		const { initTelemetry, updateTelemetryConsent } = await import(
			'./telemetry'
		);
		initTelemetry();

		updateTelemetryConsent(true);
		expect(posthog.opt_in_capturing).toHaveBeenCalled();

		updateTelemetryConsent(false);
		expect(posthog.opt_out_capturing).toHaveBeenCalled();
	});
});
