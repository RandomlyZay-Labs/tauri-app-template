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
	const portalTheme = await executeSafeAction(() => commands.getSystemTheme());
	if (portalTheme === 'dark') return 'dark';
	if (portalTheme === 'light') return 'light';

	return window.matchMedia('(prefers-color-scheme: dark)').matches
		? 'dark'
		: 'light';
}

class ThemeStore {
	theme = $state<Theme>('system');
	private themeApplyId = 0;

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
						this.themeApplyId++;
						void this.applyTheme('system', this.themeApplyId);
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

			const resolved = ['dark', 'light', 'no-preference'].includes(
				event.payload,
			)
				? event.payload
				: 'light';

			const root = window.document.documentElement;
			root.classList.remove('light', 'dark');
			root.classList.add(resolved === 'no-preference' ? 'light' : resolved);

			// On non-Windows platforms (like Linux), we need to explicitly lock the backend theme
			// to ensure the window decorations (titlebar) update correctly.
			// On Windows, we skip this to maintain the native theme tracking state (setTheme(null)).
			const isWindows = navigator.userAgent.includes('Win');
			if (!isWindows) {
				void executeSafeAction(() =>
					commands.setTheme(resolved === 'no-preference' ? null : resolved),
				);
			}
		});
	}

	private async hydrate() {
		const saved = await loadPersistedState(persistConfig);
		if (saved.theme !== undefined) {
			this.setTheme(saved.theme);
		} else {
			this.themeApplyId++;
			void this.applyTheme(this.theme, this.themeApplyId);
		}
	}

	private persist() {
		void savePersistedState(persistConfig, { theme: this.theme });
	}

	private async applyTheme(theme: Theme, tokenId: number) {
		let resolvedTheme: 'light' | 'dark' = theme === 'dark' ? 'dark' : 'light';
		if (theme === 'system') {
			resolvedTheme = await resolveSystemTheme();
		}

		if (tokenId !== this.themeApplyId) return;

		const root = window.document.documentElement;
		root.classList.remove('light', 'dark');
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
		this.themeApplyId++;
		void this.applyTheme(theme, this.themeApplyId);
		this.persist();
	}
}

export const themeStore = new ThemeStore();
