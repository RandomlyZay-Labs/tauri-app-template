import { beforeEach, describe, expect, it } from 'vitest';
import { networkStore } from './networkStore.svelte';

describe('networkStore', () => {
	beforeEach(() => {
		networkStore.isOffline = false;
	});

	it('defaults to online', () => {
		expect(networkStore.isOffline).toBe(false);
	});

	it('setIsOffline updates the state', () => {
		networkStore.setIsOffline(true);
		expect(networkStore.isOffline).toBe(true);

		networkStore.setIsOffline(false);
		expect(networkStore.isOffline).toBe(false);
	});
});
