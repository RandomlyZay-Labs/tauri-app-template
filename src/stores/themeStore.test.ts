import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadPersistedState = vi.fn().mockResolvedValue({});
const mockSavePersistedState = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/store-utils', () => ({
	loadPersistedState: (...args: unknown[]) => mockLoadPersistedState(...args),
	savePersistedState: (...args: unknown[]) => mockSavePersistedState(...args),
}));

describe('themeStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadPersistedState.mockResolvedValue({});
		document.documentElement.classList.remove('light', 'dark');
	});

	async function freshStore() {
		vi.resetModules();
		const mod = await import('./themeStore.svelte');
		await vi.waitFor(() => {
			expect(mockLoadPersistedState).toHaveBeenCalled();
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

		expect(store.theme).toBe('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		expect(document.documentElement.classList.contains('light')).toBe(false);
	});

	it('setTheme applies light class to document', async () => {
		const store = await freshStore();

		store.setTheme('light');

		expect(store.theme).toBe('light');
		expect(document.documentElement.classList.contains('light')).toBe(true);
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('setTheme with system resolves via matchMedia', async () => {
		const store = await freshStore();

		store.setTheme('system');

		const root = document.documentElement;
		const hasThemeClass =
			root.classList.contains('dark') || root.classList.contains('light');
		expect(hasThemeClass).toBe(true);
	});

	it('setTheme removes previous theme class before applying new one', async () => {
		const store = await freshStore();

		store.setTheme('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);

		store.setTheme('light');
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(document.documentElement.classList.contains('light')).toBe(true);
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
});
