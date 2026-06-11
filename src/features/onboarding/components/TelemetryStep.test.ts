// SPDX-License-Identifier: MIT
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as telemetryLib from '@/lib/telemetry';
import { uiStore } from '@/stores/uiStore.svelte';
import TelemetryStep from './TelemetryStep.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string) => key),
}));

// Mock telemetry
vi.mock('@/lib/telemetry', () => ({
	updateTelemetryConsent: vi.fn(),
}));

describe('TelemetryStep', () => {
	beforeEach(() => {
		uiStore.setTelemetryEnabled(false);
		vi.clearAllMocks();
	});

	it('renders telemetry opt-in', () => {
		render(TelemetryStep);

		expect(screen.getByText('telemetryStep.title')).toBeTruthy();
		expect(screen.getByText('telemetryStep.optIn')).toBeTruthy();
	});

	it('toggles telemetry when switch is clicked', async () => {
		render(TelemetryStep);

		const toggle = screen.getByRole('switch');
		await fireEvent.click(toggle);

		expect(uiStore.telemetryEnabled).toBe(true);
		expect(telemetryLib.updateTelemetryConsent).toHaveBeenCalledWith(true);
	});
});
