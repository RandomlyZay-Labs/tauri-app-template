// SPDX-License-Identifier: MIT
import {
	loadPersistedState,
	type PersistConfig,
	savePersistedState,
} from '@/lib/store-utils';

export const BACKUP_INTERVALS = {
	HOURLY: 3600 * 1000,
	DAILY: 24 * 3600 * 1000,
	WEEKLY: 7 * 24 * 3600 * 1000,
} as const;

type BackupInterval = (typeof BACKUP_INTERVALS)[keyof typeof BACKUP_INTERVALS];

interface BackupPersistedState {
	enabled: boolean;
	interval: BackupInterval;
	maxBackups: number;
	lastBackupTime: number | null;
}

const persistConfig: PersistConfig<BackupPersistedState> = {
	name: 'backup-settings',
};

class BackupStore {
	enabled = $state(true);
	interval = $state<BackupInterval>(BACKUP_INTERVALS.DAILY);
	maxBackups = $state(5);
	lastBackupTime = $state<number | null>(null);
	isBackingUp = $state(false);
	_hasHydrated = $state(false);

	constructor() {
		this.hydrate();
	}

	private async hydrate() {
		const saved = await loadPersistedState(persistConfig);
		if (saved.enabled !== undefined) this.enabled = saved.enabled;
		if (saved.interval !== undefined) this.interval = saved.interval;
		if (saved.maxBackups !== undefined) this.maxBackups = saved.maxBackups;
		if (saved.lastBackupTime !== undefined)
			this.lastBackupTime = saved.lastBackupTime;
		this._hasHydrated = true;
	}

	private persist() {
		void savePersistedState(persistConfig, {
			enabled: this.enabled,
			interval: this.interval,
			maxBackups: this.maxBackups,
			lastBackupTime: this.lastBackupTime,
		});
	}

	setEnabled(enabled: boolean) {
		this.enabled = enabled;
		this.persist();
	}

	setInterval(interval: BackupInterval) {
		this.interval = interval;
		this.persist();
	}

	setMaxBackups(max: number) {
		this.maxBackups = max;
		this.persist();
	}

	setLastBackupTime(time: number) {
		this.lastBackupTime = time;
		this.persist();
	}

	setIsBackingUp(isBackingUp: boolean) {
		this.isBackingUp = isBackingUp;
	}
}

export const backupStore = new BackupStore();
