// SPDX-License-Identifier: MIT
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '@/lib/toast';
import { networkStore } from '@/stores/networkStore.svelte';
import { guardAction } from './network-guard';

vi.mock('@/stores/networkStore.svelte', () => ({
	networkStore: {
		isOffline: false,
	},
}));

vi.mock('@/lib/toast', () => ({
	toast: {
		warning: vi.fn(),
	},
}));

vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key) => `translated-${key}`),
}));

describe('network-guard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('executes action and returns result when online', () => {
		networkStore.isOffline = false;
		const action = vi.fn(() => 'success');

		const result = guardAction(action);

		expect(result).toBe('success');
		expect(action).toHaveBeenCalled();
		expect(toast.warning).not.toHaveBeenCalled();
	});

	it('blocks action, shows warning toast, and returns undefined when offline', () => {
		networkStore.isOffline = true;
		const action = vi.fn(() => 'success');

		const result = guardAction(action);

		expect(result).toBeUndefined();
		expect(action).not.toHaveBeenCalled();
		expect(toast.warning).toHaveBeenCalledWith('translated-common.offline');
	});
});
