import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadPersistedState = vi.fn().mockResolvedValue({});
const mockSavePersistedState = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/store-utils', () => ({
	loadPersistedState: (...args: unknown[]) => mockLoadPersistedState(...args),
	savePersistedState: (...args: unknown[]) => mockSavePersistedState(...args),
}));

const mockGetSystemTheme = vi.fn().mockResolvedValue(null);

vi.mock('@/bindings', () => ({
	commands: {
		getSystemTheme: (...args: unknown[]) => mockGetSystemTheme(...args),
	},
}));

const mockListen = vi.fn().mockResolvedValue(vi.fn());

vi.mock('@tauri-apps/api/event', () => ({
	listen: (...args: unknown[]) => mockListen(...args),
}));

describe('themeStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadPersistedState.mockResolvedValue({});
		mockGetSystemTheme.mockResolvedValue(null);
		document.documentElement.classList.remove('light', 'dark');
	});

	async function freshStore() {
		vi.resetModules();
		const mod = await import('./themeStore.svelte');
		await vi.waitFor(() => {
			expect(mockLoadPersistedState).toHaveBeenCalled();
		});
		// Allow async applyTheme to complete
		await vi.waitFor(() => {
			const root = document.documentElement;
			return (
				root.classList.contains('dark') || root.classList.contains('light')
			);
		});
		return mod.themeStore;
	}

	it('defaults to system theme', async () => {
		const store = await freshStore();
		expect(store.theme).toBe('system');
	});

	it('setTheme applies dark class to document', async () => {
		const store = await freshStore();

		store.setTheme('dark');
		await vi.waitFor(() => {
			expect(document.documentElement.classList.contains('dark')).toBe(true);
		});

		expect(store.theme).toBe('dark');
		expect(document.documentElement.classList.contains('light')).toBe(false);
	});

	it('setTheme applies light class to document', async () => {
		const store = await freshStore();

		store.setTheme('light');
		await vi.waitFor(() => {
			expect(document.documentElement.classList.contains('light')).toBe(true);
		});

		expect(store.theme).toBe('light');
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('setTheme with system resolves via matchMedia', async () => {
		const store = await freshStore();

		store.setTheme('system');

		await vi.waitFor(() => {
			const root = document.documentElement;
			const hasThemeClass =
				root.classList.contains('dark') || root.classList.contains('light');
			expect(hasThemeClass).toBe(true);
		});
	});

	it('setTheme removes previous theme class before applying new one', async () => {
		const store = await freshStore();

		store.setTheme('dark');
		await vi.waitFor(() => {
			expect(document.documentElement.classList.contains('dark')).toBe(true);
		});

		store.setTheme('light');
		await vi.waitFor(() => {
			expect(document.documentElement.classList.contains('light')).toBe(true);
		});
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('persists theme on setTheme', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();

		store.setTheme('dark');

		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'theme-storage' }),
			{ theme: 'dark' },
		);
	});

	it('hydrates theme from persisted state', async () => {
		mockLoadPersistedState.mockResolvedValue({ theme: 'light' });
		const store = await freshStore();

		expect(store.theme).toBe('light');
		expect(document.documentElement.classList.contains('light')).toBe(true);
	});

	it('applies system theme when no persisted state exists', async () => {
		mockLoadPersistedState.mockResolvedValue({});
		const store = await freshStore();

		expect(store.theme).toBe('system');
		const root = document.documentElement;
		expect(
			root.classList.contains('dark') || root.classList.contains('light'),
		).toBe(true);
	});

	it('updates theme automatically when system theme changes', async () => {
		let changeHandler: (() => void) | null = null;
		let matches = false;

		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockImplementation((query: string) => ({
				matches,
				media: query,
				addEventListener: vi.fn().mockImplementation((event, handler) => {
					if (event === 'change') changeHandler = handler;
				}),
				removeEventListener: vi.fn(),
			})),
		);

		const store = await freshStore();
		expect(store.theme).toBe('system');

		// Initially light
		matches = false;
		store.setTheme('system');
		await vi.waitFor(() => {
			expect(document.documentElement.classList.contains('light')).toBe(true);
		});

		// Switch to dark
		matches = true;
		if (changeHandler) (changeHandler as () => void)();

		await vi.waitFor(() => {
			expect(document.documentElement.classList.contains('dark')).toBe(true);
		});
		expect(document.documentElement.classList.contains('light')).toBe(false);

		vi.unstubAllGlobals();
	});

	it('uses portal theme when matchMedia is unreliable', async () => {
		mockGetSystemTheme.mockResolvedValue('dark');

		const store = await freshStore();
		expect(store.theme).toBe('system');

		await vi.waitFor(() => {
			expect(document.documentElement.classList.contains('dark')).toBe(true);
		});
	});

	it('falls back to matchMedia when portal returns null', async () => {
		mockGetSystemTheme.mockResolvedValue(null);

		const store = await freshStore();
		expect(store.theme).toBe('system');

		await vi.waitFor(() => {
			const root = document.documentElement;
			expect(
				root.classList.contains('dark') || root.classList.contains('light'),
			).toBe(true);
		});
	});

	it('registers a listener for system-theme-changed events', async () => {
		await freshStore();

		expect(mockListen).toHaveBeenCalledWith(
			'system-theme-changed',
			expect.any(Function),
		);
	});
});
