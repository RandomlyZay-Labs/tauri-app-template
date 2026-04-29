import { tauriStorage } from '@/lib/tauri-storage';

/**
 * Persisted store configuration. Each store that needs persistence
 * provides a name and optionally a partialize function to select
 * which keys to persist.
 */
export interface PersistConfig<T> {
	name: string;
	partialize?: (state: T) => Partial<T>;
	onRehydrate?: (state: T) => void;
}

/**
 * Load persisted state from Tauri Store (or localStorage fallback).
 * Returns partial state to merge into the store on startup.
 */
export async function loadPersistedState<T>(
	config: PersistConfig<T>,
): Promise<Partial<T>> {
	try {
		const raw = await tauriStorage.getItem(config.name);
		if (raw) {
			const parsed = JSON.parse(raw);
			// Zustand format: { state: {...}, version: 0 }
			if (parsed.state) {
				return parsed.state as Partial<T>;
			}
			return parsed as Partial<T>;
		}
	} catch (err) {
		console.warn(`Failed to load persisted state for "${config.name}":`, err);
	}
	return {};
}

/**
 * Save state to Tauri Store (or localStorage fallback).
 * Uses the same format as the previous Zustand implementation for compatibility.
 */
export async function savePersistedState<T>(
	config: PersistConfig<T>,
	state: T,
): Promise<void> {
	try {
		const toSave = config.partialize ? config.partialize(state) : state;
		const serialized = JSON.stringify({ state: toSave, version: 0 });
		await tauriStorage.setItem(config.name, serialized);
	} catch (err) {
		console.warn(`Failed to save persisted state for "${config.name}":`, err);
	}
}
