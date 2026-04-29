import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadPersistedState = vi.fn().mockResolvedValue({});
const mockSavePersistedState = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/store-utils', () => ({
	loadPersistedState: (...args: unknown[]) => mockLoadPersistedState(...args),
	savePersistedState: (...args: unknown[]) => mockSavePersistedState(...args),
}));

vi.mock('@/lib/utils', () => ({
	getSystemAnimationPreference: () => true,
}));

describe('animationStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadPersistedState.mockResolvedValue({});
		document.documentElement.classList.remove('no-animations');
	});

	async function freshStore() {
		vi.resetModules();
		const mod = await import('./animationStore.svelte');
		await vi.waitFor(() => {
			expect(mockLoadPersistedState).toHaveBeenCalled();
		});
		return mod.animationStore;
	}

	it('defaults to system animation preference (true)', async () => {
		const store = await freshStore();
		expect(store.animationsEnabled).toBe(true);
	});

	it('applies no-animations class when disabled', async () => {
		const store = await freshStore();
		store.setAnimationsEnabled(false);

		expect(store.animationsEnabled).toBe(false);
		expect(document.documentElement.classList.contains('no-animations')).toBe(
			true,
		);
	});

	it('removes no-animations class when enabled', async () => {
		const store = await freshStore();
		store.setAnimationsEnabled(false);
		store.setAnimationsEnabled(true);

		expect(document.documentElement.classList.contains('no-animations')).toBe(
			false,
		);
	});

	it('persists state on setAnimationsEnabled', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();

		store.setAnimationsEnabled(false);

		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'animation-storage' }),
			{ animationsEnabled: false },
		);
	});

	it('hydrates from persisted state', async () => {
		mockLoadPersistedState.mockResolvedValue({ animationsEnabled: false });
		const store = await freshStore();

		expect(store.animationsEnabled).toBe(false);
		expect(document.documentElement.classList.contains('no-animations')).toBe(
			true,
		);
	});

	it('does not override default when persisted state has no animationsEnabled', async () => {
		mockLoadPersistedState.mockResolvedValue({});
		const store = await freshStore();

		expect(store.animationsEnabled).toBe(true);
	});
});
