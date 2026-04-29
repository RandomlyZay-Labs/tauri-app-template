import { commands } from '@/lib/ipc';
import {
	loadPersistedState,
	type PersistConfig,
	savePersistedState,
} from '@/lib/store-utils';

interface TrayPersistedState {
	minimizeToTray: boolean;
	notifyOnMinimize: boolean;
}

const persistConfig: PersistConfig<TrayPersistedState> = {
	name: 'tray-settings',
};

class TrayStore {
	minimizeToTray = $state(false);
	notifyOnMinimize = $state(true);

	constructor() {
		this.hydrate();
	}

	private async hydrate() {
		const saved = await loadPersistedState(persistConfig);
		if (saved.minimizeToTray !== undefined)
			this.minimizeToTray = saved.minimizeToTray;
		if (saved.notifyOnMinimize !== undefined)
			this.notifyOnMinimize = saved.notifyOnMinimize;
		void this.syncToBackend();
	}

	private persist() {
		void savePersistedState(persistConfig, {
			minimizeToTray: this.minimizeToTray,
			notifyOnMinimize: this.notifyOnMinimize,
		});
	}

	setMinimizeToTray(enabled: boolean) {
		this.minimizeToTray = enabled;
		this.persist();
		void this.syncToBackend();
	}

	setNotifyOnMinimize(enabled: boolean) {
		this.notifyOnMinimize = enabled;
		this.persist();
		void this.syncToBackend();
	}

	async syncToBackend() {
		try {
			await commands.setTraySettings(
				this.minimizeToTray,
				this.notifyOnMinimize,
			);
		} catch (e) {
			console.error('Failed to sync tray settings to backend:', e);
		}
	}
}

export const trayStore = new TrayStore();
