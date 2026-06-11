// SPDX-License-Identifier: MIT
import { commands } from '@/lib/ipc';
import {
	loadPersistedState,
	type PersistConfig,
	savePersistedState,
} from '@/lib/store-utils';

interface WatcherPersistedState {
	watchedPaths: string[];
}

const persistConfig: PersistConfig<WatcherPersistedState> = {
	name: 'watcher-storage',
};

class WatcherStore {
	watchedPaths = $state<string[]>([]);

	constructor() {
		this.hydrate();
	}

	private async hydrate() {
		const saved = await loadPersistedState(persistConfig);
		if (saved.watchedPaths) {
			this.watchedPaths = saved.watchedPaths;
			for (const path of this.watchedPaths) {
				void commands.watchPath(path).catch(console.error);
			}
		}
	}

	private persist() {
		void savePersistedState(persistConfig, {
			watchedPaths: this.watchedPaths,
		});
	}

	addPath(path: string) {
		if (!this.watchedPaths.includes(path)) {
			this.watchedPaths = [...this.watchedPaths, path];
			this.persist();
			void commands.watchPath(path).catch(console.error);
		}
	}

	removePath(path: string) {
		this.watchedPaths = this.watchedPaths.filter((p) => p !== path);
		this.persist();
		void commands.unwatchPath(path).catch(console.error);
	}
}

export const watcherStore = new WatcherStore();
