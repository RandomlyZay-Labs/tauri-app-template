import { executeSafeAction } from '@/lib/async-utils';
import { commands } from '@/lib/ipc';
import {
	loadPersistedState,
	type PersistConfig,
	savePersistedState,
} from '@/lib/store-utils';

const ALLOWED_SETTINGS_TABS = [
	'general',
	'appearance',
	'backups',
	'debug',
	'updates',
] as const;
export type SettingsTab = (typeof ALLOWED_SETTINGS_TABS)[number];

export function validateSettingsTab(tab: unknown): SettingsTab {
	if (
		typeof tab === 'string' &&
		ALLOWED_SETTINGS_TABS.includes(tab as SettingsTab)
	) {
		return tab as SettingsTab;
	}
	return 'general';
}

const ALLOWED_TOAST_POSITIONS = [
	'top-left',
	'top-center',
	'top-right',
	'bottom-left',
	'bottom-center',
	'bottom-right',
] as const;
export type ToastPosition = (typeof ALLOWED_TOAST_POSITIONS)[number];

function validateToastPosition(pos: unknown): ToastPosition {
	if (
		typeof pos === 'string' &&
		ALLOWED_TOAST_POSITIONS.includes(pos as ToastPosition)
	) {
		return pos as ToastPosition;
	}
	return 'top-right';
}

interface UIPersistedState {
	sidebarOpen: boolean;
	onboardingCompleted: boolean;
	contextMenuEnabled: boolean;
	telemetryEnabled: boolean;
	logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
	autoCheckUpdates: boolean;
	activeSettingsTab?: SettingsTab;
	toastPosition?: ToastPosition;
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
	autoCheckUpdates = $state(true);
	toastPosition = $state<ToastPosition>('top-right');
	_hasHydrated = $state(false);
	activeSettingsTab = $state<SettingsTab>(validateSettingsTab('general'));

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
		if (saved.autoCheckUpdates !== undefined)
			this.autoCheckUpdates = saved.autoCheckUpdates;
		if (saved.toastPosition !== undefined)
			this.toastPosition = validateToastPosition(saved.toastPosition);
		if (saved.activeSettingsTab !== undefined)
			this.activeSettingsTab = validateSettingsTab(saved.activeSettingsTab);
		this._hasHydrated = true;
	}

	private persist() {
		void savePersistedState(persistConfig, {
			sidebarOpen: this.sidebarOpen,
			onboardingCompleted: this.onboardingCompleted,
			contextMenuEnabled: this.contextMenuEnabled,
			telemetryEnabled: this.telemetryEnabled,
			logLevel: this.logLevel,
			autoCheckUpdates: this.autoCheckUpdates,
			activeSettingsTab: this.activeSettingsTab,
			toastPosition: this.toastPosition,
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

	setAutoCheckUpdates(enabled: boolean) {
		this.autoCheckUpdates = enabled;
		this.persist();
	}

	setActiveSettingsTab(tab: unknown) {
		this.activeSettingsTab = validateSettingsTab(tab);
		this.persist();
	}

	setToastPosition(position: ToastPosition) {
		this.toastPosition = position;
		this.persist();
	}
}

export const uiStore = new UIStore();
