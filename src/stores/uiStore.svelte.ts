import { executeSafeAction } from '@/lib/async-utils';
import { commands } from '@/lib/ipc';
import {
	loadPersistedState,
	type PersistConfig,
	savePersistedState,
} from '@/lib/store-utils';

interface UIPersistedState {
	sidebarOpen: boolean;
	onboardingCompleted: boolean;
	contextMenuEnabled: boolean;
	telemetryEnabled: boolean;
	logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

const persistConfig: PersistConfig<UIPersistedState> = {
	name: 'ui-storage',
};

class UIStore {
	sidebarOpen = $state(true);
	onboardingCompleted = $state(false);
	contextMenuEnabled = $state(false);
	telemetryEnabled = $state(false);
	commandPaletteOpen = $state(false);
	logLevel = $state<'trace' | 'debug' | 'info' | 'warn' | 'error'>('error');
	_hasHydrated = $state(false);

	constructor() {
		this.hydrate();
	}

	private async hydrate() {
		const saved = await loadPersistedState(persistConfig);
		if (saved.sidebarOpen !== undefined) this.sidebarOpen = saved.sidebarOpen;
		if (saved.onboardingCompleted !== undefined)
			this.onboardingCompleted = saved.onboardingCompleted;
		if (saved.contextMenuEnabled !== undefined)
			this.contextMenuEnabled = saved.contextMenuEnabled;
		if (saved.telemetryEnabled !== undefined)
			this.telemetryEnabled = saved.telemetryEnabled;
		if (saved.logLevel !== undefined) this.logLevel = saved.logLevel;
		this._hasHydrated = true;
	}

	private persist() {
		void savePersistedState(persistConfig, {
			sidebarOpen: this.sidebarOpen,
			onboardingCompleted: this.onboardingCompleted,
			contextMenuEnabled: this.contextMenuEnabled,
			telemetryEnabled: this.telemetryEnabled,
			logLevel: this.logLevel,
		});
	}

	toggleSidebar() {
		this.sidebarOpen = !this.sidebarOpen;
		this.persist();
	}

	setSidebarOpen(open: boolean) {
		this.sidebarOpen = open;
		this.persist();
	}

	setOnboardingCompleted(completed: boolean) {
		this.onboardingCompleted = completed;
		this.persist();
	}

	setContextMenuEnabled(enabled: boolean) {
		this.contextMenuEnabled = enabled;
		this.persist();
	}

	setTelemetryEnabled(enabled: boolean) {
		this.telemetryEnabled = enabled;
		this.persist();
	}
	setCommandPaletteOpen(open: boolean | ((prev: boolean) => boolean)) {
		this.commandPaletteOpen =
			typeof open === 'function' ? open(this.commandPaletteOpen) : open;
	}

	setLogLevel(level: 'trace' | 'debug' | 'info' | 'warn' | 'error') {
		this.logLevel = level;
		this.persist();
		void executeSafeAction(() => commands.setLogLevel(level));
	}
}

export const uiStore = new UIStore();
