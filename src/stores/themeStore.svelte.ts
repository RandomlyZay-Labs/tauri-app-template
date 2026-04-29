import {
	loadPersistedState,
	type PersistConfig,
	savePersistedState,
} from '@/lib/store-utils';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeOption {
	value: Theme;
	labelKey: string;
	icon: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
	{ value: 'light', labelKey: 'common.light', icon: 'sun' },
	{ value: 'dark', labelKey: 'common.dark', icon: 'moon' },
	{ value: 'system', labelKey: 'common.system', icon: 'laptop' },
];

interface ThemePersistedState {
	theme: Theme;
}

const persistConfig: PersistConfig<ThemePersistedState> = {
	name: 'theme-storage',
};

class ThemeStore {
	theme = $state<Theme>('system');

	constructor() {
		this.hydrate();
	}

	private async hydrate() {
		const saved = await loadPersistedState(persistConfig);
		if (saved.theme !== undefined) {
			this.setTheme(saved.theme);
		} else {
			this.applyTheme(this.theme);
		}
	}

	private persist() {
		void savePersistedState(persistConfig, { theme: this.theme });
	}

	private applyTheme(theme: Theme) {
		const root = window.document.documentElement;
		root.classList.remove('light', 'dark');

		if (theme === 'system') {
			const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
				.matches
				? 'dark'
				: 'light';
			root.classList.add(systemTheme);
			return;
		}

		root.classList.add(theme);
	}

	setTheme(theme: Theme) {
		this.theme = theme;
		this.applyTheme(theme);
		this.persist();
	}
}

export const themeStore = new ThemeStore();
