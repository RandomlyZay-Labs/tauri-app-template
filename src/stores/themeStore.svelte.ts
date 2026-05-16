import { listen } from '@tauri-apps/api/event';
import { commands } from '@/bindings';
import { executeSafeAction } from '@/lib/async-utils';
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

/**
 * Resolves the actual system color scheme by trying the Freedesktop portal
 * first (fixes Fedora/WebKitGTK), then falling back to `matchMedia`.
 */
async function resolveSystemTheme(): Promise<'dark' | 'light'> {
	try {
		const portalTheme = await commands.getSystemTheme();
		if (portalTheme === 'dark') return 'dark';
		if (portalTheme === 'light') return 'light';
	} catch {
		// Portal unavailable (non-Linux, no D-Bus) — expected
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches
		? 'dark'
		: 'light';
}

class ThemeStore {
	theme = $state<Theme>('system');

	constructor() {
		this.hydrate();
		this.setupSystemListener();
		this.setupPortalListener();
	}

	private setupSystemListener() {
		if (typeof window !== 'undefined') {
			window
				.matchMedia('(prefers-color-scheme: dark)')
				.addEventListener('change', () => {
					if (this.theme === 'system') {
						void this.applyTheme('system');
					}
				});
		}
	}

	/**
	 * Listens for `system-theme-changed` events emitted by the Rust backend
	 * when the Freedesktop portal reports a color-scheme change.
	 */
	private setupPortalListener() {
		if (typeof window === 'undefined') return;

		void listen<string>('system-theme-changed', (event) => {
			if (this.theme !== 'system') return;

			const resolved = event.payload === 'dark' ? 'dark' : 'light';

			const root = window.document.documentElement;
			root.classList.remove('light', 'dark');
			root.classList.add(resolved);

			// On non-Windows platforms (like Linux), we need to explicitly lock the backend theme
			// to ensure the window decorations (titlebar) update correctly.
			// On Windows, we skip this to maintain the native theme tracking state (setTheme(null)).
			const isWindows = navigator.userAgent.includes('Win');
			if (!isWindows) {
				void executeSafeAction(() => commands.setTheme(resolved));
			}
		});
	}

	private async hydrate() {
		const saved = await loadPersistedState(persistConfig);
		if (saved.theme !== undefined) {
			this.setTheme(saved.theme);
		} else {
			void this.applyTheme(this.theme);
		}
	}

	private persist() {
		void savePersistedState(persistConfig, { theme: this.theme });
	}

	private async applyTheme(theme: Theme) {
		const root = window.document.documentElement;
		root.classList.remove('light', 'dark');

		let resolvedTheme: 'light' | 'dark' = theme === 'dark' ? 'dark' : 'light';
		if (theme === 'system') {
			resolvedTheme = await resolveSystemTheme();
		}

		root.classList.add(resolvedTheme);

		// On Windows, passing null for the 'system' theme enables native tracking for the titlebar.
		// On other platforms (like Linux), we explicitly set the theme to ensure decorations update.
		const isWindows =
			typeof window !== 'undefined' && navigator.userAgent.includes('Win');
		const backendTheme = theme === 'system' && isWindows ? null : resolvedTheme;
		void executeSafeAction(() => commands.setTheme(backendTheme));
	}

	setTheme(theme: Theme) {
		this.theme = theme;
		void this.applyTheme(theme);
		this.persist();
	}
}

export const themeStore = new ThemeStore();
