// SPDX-License-Identifier: MIT
import { isTauri } from '@tauri-apps/api/core';
import { mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockStoreInstance = {
	get: vi.fn(),
	set: vi.fn().mockResolvedValue(undefined),
	delete: vi.fn().mockResolvedValue(undefined),
	save: vi.fn().mockResolvedValue(undefined),
	clear: vi.fn().mockResolvedValue(undefined),
};

/**
 * Sets up mock IPC for Tauri commands
 */
function setupTauriMocks() {
	mockIPC(async (cmd, args) => {
		if (cmd === 'plugin:path|join') {
			return (args.paths as string[]).join('/');
		}
		if (cmd === 'plugin:store|load') {
			return 'mock-store-id';
		}
		if (cmd === 'plugin:store|get') {
			return mockStoreInstance.get(args.key);
		}
		if (cmd === 'plugin:store|set') {
			return mockStoreInstance.set(args.key, args.value);
		}
		if (cmd === 'plugin:store|delete') {
			return mockStoreInstance.delete(args.key);
		}
		if (cmd === 'plugin:store|save') {
			return mockStoreInstance.save();
		}
		if (cmd === 'plugin:store|clear') {
			return mockStoreInstance.clear();
		}
		if (cmd === 'plugin:log|log') {
			return;
		}
	});
}

/**
 * Removes Tauri environment markers to simulate a browser-only environment
 */
function simulateBrowserEnv() {
	// biome-ignore lint/suspicious/noExplicitAny: test helper
	delete (window as any).__TAURI_IPC__;
}

// Consolidated mock for IPC commands
vi.mock('@/lib/ipc', () => ({
	commands: {
		getDataDir: vi.fn().mockResolvedValue('/app-data'),
	},
}));

vi.mock('@tauri-apps/api/core', async (importOriginal) => {
	const original =
		await importOriginal<typeof import('@tauri-apps/api/core')>();
	return {
		...original,
		isTauri: vi.fn().mockReturnValue(true),
	};
});

// Mock for Store class from plugin-store
vi.mock('@tauri-apps/plugin-store', () => {
	return {
		Store: {
			load: vi.fn().mockImplementation(async () => mockStoreInstance),
		},
	};
});

/**
 * The tauri-storage module caches the store instance.
 * We need a fresh import for each test to reset that cache.
 */
async function freshImport() {
	// Instead of resetModules which can be flaky with global window state,
	// we just re-import and rely on our manual mocks.
	const mod = await import('@/lib/tauri-storage');
	return mod;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(isTauri).mockReturnValue(false);
	simulateBrowserEnv();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('tauriStorage', () => {
	describe('browser fallback (non-Tauri)', () => {
		it('getItem reads from localStorage', async () => {
			const { tauriStorage } = await freshImport();
			const spy = vi
				.spyOn(Storage.prototype, 'getItem')
				.mockReturnValue('{"foo":"bar"}');

			const result = await tauriStorage.getItem('test-key');

			expect(spy).toHaveBeenCalledWith('test-key');
			expect(result).toBe('{"foo":"bar"}');
			spy.mockRestore();
		});

		it('getItem returns null when key is absent in localStorage', async () => {
			const { tauriStorage } = await freshImport();
			const spy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

			const result = await tauriStorage.getItem('missing');

			expect(result).toBeNull();
			spy.mockRestore();
		});

		it('setItem writes to localStorage', async () => {
			const { tauriStorage } = await freshImport();
			const spy = vi
				.spyOn(Storage.prototype, 'setItem')
				.mockImplementation(() => {});

			await tauriStorage.setItem('key', '{"val":1}');

			expect(spy).toHaveBeenCalledWith('key', '{"val":1}');
			spy.mockRestore();
		});

		it('removeItem removes from localStorage', async () => {
			const { tauriStorage } = await freshImport();
			const spy = vi
				.spyOn(Storage.prototype, 'removeItem')
				.mockImplementation(() => {});

			await tauriStorage.removeItem('key');

			expect(spy).toHaveBeenCalledWith('key');
			spy.mockRestore();
		});
	});

	describe('Tauri store path', () => {
		beforeEach(() => {
			vi.mocked(isTauri).mockReturnValue(true);
			setupTauriMocks();
		});
		it('getItem retrieves and JSON-stringifies value from Tauri store', async () => {
			setupTauriMocks();
			const { tauriStorage } = await freshImport();
			mockStoreInstance.get.mockResolvedValue({ hello: 'world' });

			const result = await tauriStorage.getItem('my-key');

			expect(mockStoreInstance.get).toHaveBeenCalledWith('my-key');
			expect(result).toBe(JSON.stringify({ hello: 'world' }));
		});

		it('getItem returns null when value is falsy in Tauri store', async () => {
			setupTauriMocks();
			const { tauriStorage } = await freshImport();
			mockStoreInstance.get.mockResolvedValue(null);

			const result = await tauriStorage.getItem('empty');

			expect(result).toBeNull();
		});

		it('getItem returns null and warns on store error', async () => {
			setupTauriMocks();
			const { tauriStorage } = await freshImport();
			mockStoreInstance.get.mockRejectedValue(new Error('store error'));
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const result = await tauriStorage.getItem('broken');

			expect(result).toBeNull();
			expect(warnSpy).toHaveBeenCalled();
			warnSpy.mockRestore();
		});

		it('setItem parses JSON and persists via Tauri store', async () => {
			setupTauriMocks();
			const { tauriStorage } = await freshImport();

			await tauriStorage.setItem('k', '{"a":1}');

			expect(mockStoreInstance.set).toHaveBeenCalledWith('k', { a: 1 });
			expect(mockStoreInstance.save).toHaveBeenCalledOnce();
		});

		it('setItem warns on store error', async () => {
			setupTauriMocks();
			const { tauriStorage } = await freshImport();
			mockStoreInstance.set.mockRejectedValueOnce(new Error('write fail'));
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			await tauriStorage.setItem('k', '{"a":1}');

			expect(warnSpy).toHaveBeenCalled();
			warnSpy.mockRestore();
		});

		it('removeItem deletes and persists via Tauri store', async () => {
			setupTauriMocks();
			const { tauriStorage } = await freshImport();

			await tauriStorage.removeItem('k');

			expect(mockStoreInstance.delete).toHaveBeenCalledWith('k');
			expect(mockStoreInstance.save).toHaveBeenCalledOnce();
		});

		it('removeItem warns on store error', async () => {
			setupTauriMocks();
			const { tauriStorage } = await freshImport();
			mockStoreInstance.delete.mockRejectedValueOnce(new Error('delete fail'));
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			await tauriStorage.removeItem('k');

			expect(warnSpy).toHaveBeenCalled();
			warnSpy.mockRestore();
		});
	});
});

describe('clearPersistentStore', () => {
	it('clears localStorage in non-Tauri env', async () => {
		simulateBrowserEnv();
		const { clearPersistentStore } = await freshImport();
		const spy = vi
			.spyOn(Storage.prototype, 'clear')
			.mockImplementation(() => {});

		await clearPersistentStore();

		expect(spy).toHaveBeenCalledOnce();
		spy.mockRestore();
	});

	it('clears and saves Tauri store in Tauri env', async () => {
		vi.mocked(isTauri).mockReturnValue(true);
		setupTauriMocks();
		const { clearPersistentStore } = await freshImport();

		await clearPersistentStore();

		expect(mockStoreInstance.clear).toHaveBeenCalledOnce();
		expect(mockStoreInstance.save).toHaveBeenCalledOnce();
	});

	it('warns on error when clearing Tauri store', async () => {
		vi.mocked(isTauri).mockReturnValue(true);
		setupTauriMocks();
		const { clearPersistentStore } = await freshImport();
		mockStoreInstance.clear.mockRejectedValueOnce(new Error('clear fail'));
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await clearPersistentStore();

		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});
