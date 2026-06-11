// SPDX-License-Identifier: MIT
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPersistedState, savePersistedState } from './store-utils';
import { tauriStorage } from './tauri-storage';

vi.mock('./tauri-storage', () => ({
	tauriStorage: {
		getItem: vi.fn(),
		setItem: vi.fn(),
	},
}));

describe('store-utils', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('loadPersistedState', () => {
		it('returns state from tauriStorage when it exists', async () => {
			const mockState = { foo: 'bar' };
			vi.mocked(tauriStorage.getItem).mockResolvedValue(
				JSON.stringify({ state: mockState }),
			);

			const result = await loadPersistedState({ name: 'test-store' });
			expect(result).toEqual(mockState);
		});

		it('returns empty object when tauriStorage is empty', async () => {
			vi.mocked(tauriStorage.getItem).mockResolvedValue(null);

			const result = await loadPersistedState({ name: 'test-store' });
			expect(result).toEqual({});
		});

		it('recovers safely from corrupted JSON', async () => {
			vi.mocked(tauriStorage.getItem).mockResolvedValue('corrupted { json');

			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const result = await loadPersistedState({ name: 'test-store' });

			expect(result).toEqual({});
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'Failed to load persisted state for "test-store"',
				),
				expect.any(Error),
			);
			consoleSpy.mockRestore();
		});

		it('handles non-zustand format JSON', async () => {
			const mockState = { foo: 'bar' };
			vi.mocked(tauriStorage.getItem).mockResolvedValue(
				JSON.stringify(mockState),
			);

			const result = await loadPersistedState({ name: 'test-store' });
			expect(result).toEqual(mockState);
		});
	});

	describe('savePersistedState', () => {
		it('saves state to tauriStorage in zustand format', async () => {
			const mockState = { foo: 'bar' };
			await savePersistedState({ name: 'test-store' }, mockState);

			expect(tauriStorage.setItem).toHaveBeenCalledWith(
				'test-store',
				JSON.stringify({ state: mockState, version: 0 }),
			);
		});

		it('uses partialize function if provided', async () => {
			const mockState = { foo: 'bar', secret: '123' };
			const config = {
				name: 'test-store',
				partialize: (state: { foo: string; secret: string }) => ({
					foo: state.foo,
				}),
			};
			await savePersistedState(config, mockState);

			expect(tauriStorage.setItem).toHaveBeenCalledWith(
				'test-store',
				JSON.stringify({ state: { foo: 'bar' }, version: 0 }),
			);
		});
	});
});
