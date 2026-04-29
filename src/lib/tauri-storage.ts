// SPDX-License-Identifier: MIT
import { isTauri } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { Store } from '@tauri-apps/plugin-store';
import { commands } from '@/lib/ipc';

let storeInstance: Promise<Store> | null = null;

const getStore = async () => {
	if (storeInstance) return storeInstance;

	storeInstance = (async () => {
		try {
			const dataDir = await commands.getDataDir();
			const path = dataDir ? await join(dataDir, 'store.bin') : 'store.bin';
			const store = await Store.load(path);
			return store;
		} catch (error) {
			storeInstance = null;
			throw error;
		}
	})();

	return storeInstance;
};

/**
 * Framework-agnostic storage API backed by Tauri Store (file system)
 * with localStorage fallback for browser-only environments.
 */
export const tauriStorage = {
	getItem: async (name: string): Promise<string | null> => {
		if (!isTauri()) {
			return localStorage.getItem(name);
		}

		try {
			const store = await getStore();
			const value = await store.get(name);
			return value ? JSON.stringify(value) : null;
		} catch (err) {
			console.warn('Failed to get item from Tauri store:', err);
			return null;
		}
	},
	setItem: async (name: string, value: string): Promise<void> => {
		if (!isTauri()) {
			localStorage.setItem(name, value);
			return;
		}

		try {
			const store = await getStore();
			await store.set(name, JSON.parse(value));
			await store.save();
		} catch (err) {
			console.warn('Failed to set item in Tauri store:', err);
		}
	},
	removeItem: async (name: string): Promise<void> => {
		if (!isTauri()) {
			localStorage.removeItem(name);
			return;
		}

		try {
			const store = await getStore();
			await store.delete(name);
			await store.save();
		} catch (err) {
			console.warn('Failed to remove item from Tauri store:', err);
		}
	},
};

/**
 * Explicitly clears the persistent store.
 */
export const clearPersistentStore = async () => {
	if (!isTauri()) {
		localStorage.clear();
		return;
	}
	try {
		const store = await getStore();
		await store.clear();
		await store.save();
	} catch (err) {
		console.warn('Failed to clear Tauri store:', err);
	}
};
