// SPDX-License-Identifier: MIT
import { mount } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('svelte', () => ({
	mount: vi.fn(),
}));

vi.mock('./App.svelte', () => ({
	default: vi.fn(),
}));

vi.mock('./lib/telemetry', () => ({
	initTelemetry: vi.fn(),
}));

vi.mock('./lib/i18n', () => ({}));
vi.mock('./index.css', () => ({}));

describe('main.ts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		document.body.innerHTML = '<div id="root"></div>';
	});

	it('mounts the app', async () => {
		await import('./main');

		expect(mount).toHaveBeenCalledWith(expect.anything(), {
			target: expect.objectContaining({ id: 'root' }),
		});
	});

	it('throws error if root element is missing', async () => {
		document.body.innerHTML = '';

		try {
			await import('./main');
			throw new Error('Should have failed');
		} catch (e) {
			expect((e as Error).message).toBe('Root element not found');
		}
	});
});
