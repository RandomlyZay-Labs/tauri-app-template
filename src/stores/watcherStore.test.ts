// SPDX-License-Identifier: MIT
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadPersistedState = vi.fn().mockResolvedValue({});
const mockSavePersistedState = vi.fn().mockResolvedValue(undefined);
const mockWatchPath = vi.fn().mockResolvedValue(undefined);
const mockUnwatchPath = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/store-utils', () => ({
	loadPersistedState: (...args: unknown[]) => mockLoadPersistedState(...args),
	savePersistedState: (...args: unknown[]) => mockSavePersistedState(...args),
}));

vi.mock('@/bindings', () => ({
	commands: {
		watchPath: (...args: unknown[]) => mockWatchPath(...args),
		unwatchPath: (...args: unknown[]) => mockUnwatchPath(...args),
	},
}));

describe('watcherStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadPersistedState.mockResolvedValue({});
	});

	async function freshStore() {
		vi.resetModules();
		const mod = await import('./watcherStore.svelte');
		await vi.waitFor(() => {
			expect(mockLoadPersistedState).toHaveBeenCalled();
		});
		return mod.watcherStore;
	}

	it('defaults to empty watchedPaths', async () => {
		const store = await freshStore();
		expect(store.watchedPaths).toEqual([]);
	});

	it('addPath adds a new path, persists, and calls watchPath', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();
		mockWatchPath.mockClear();

		store.addPath('/home/user/docs');

		expect(store.watchedPaths).toEqual(['/home/user/docs']);
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'watcher-storage' }),
			{ watchedPaths: ['/home/user/docs'] },
		);
		expect(mockWatchPath).toHaveBeenCalledWith('/home/user/docs');
	});

	it('addPath does not add duplicate paths', async () => {
		const store = await freshStore();

		store.addPath('/home/user/docs');
		mockSavePersistedState.mockClear();
		mockWatchPath.mockClear();

		store.addPath('/home/user/docs');

		expect(store.watchedPaths).toEqual(['/home/user/docs']);
		expect(mockSavePersistedState).not.toHaveBeenCalled();
		expect(mockWatchPath).not.toHaveBeenCalled();
	});

	it('addPath allows multiple different paths', async () => {
		const store = await freshStore();

		store.addPath('/path/a');
		store.addPath('/path/b');

		expect(store.watchedPaths).toEqual(['/path/a', '/path/b']);
	});

	it('removePath removes a path, persists, and calls unwatchPath', async () => {
		const store = await freshStore();
		store.addPath('/path/a');
		store.addPath('/path/b');
		mockSavePersistedState.mockClear();
		mockUnwatchPath.mockClear();

		store.removePath('/path/a');

		expect(store.watchedPaths).toEqual(['/path/b']);
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'watcher-storage' }),
			{ watchedPaths: ['/path/b'] },
		);
		expect(mockUnwatchPath).toHaveBeenCalledWith('/path/a');
	});

	it('removePath on nonexistent path still persists', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();

		store.removePath('/nonexistent');

		expect(store.watchedPaths).toEqual([]);
		expect(mockSavePersistedState).toHaveBeenCalled();
	});

	it('hydrates from persisted state and issues watchPath for each', async () => {
		mockLoadPersistedState.mockResolvedValue({
			watchedPaths: ['/saved/a', '/saved/b'],
		});
		const store = await freshStore();

		expect(store.watchedPaths).toEqual(['/saved/a', '/saved/b']);

		await vi.waitFor(() => {
			expect(mockWatchPath).toHaveBeenCalledWith('/saved/a');
			expect(mockWatchPath).toHaveBeenCalledWith('/saved/b');
		});
	});

	it('does not call watchPath when hydrating with empty paths', async () => {
		mockLoadPersistedState.mockResolvedValue({});
		await freshStore();

		expect(mockWatchPath).not.toHaveBeenCalled();
	});
});
