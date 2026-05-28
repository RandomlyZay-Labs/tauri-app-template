import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadPersistedState = vi.fn().mockResolvedValue({});
const mockSavePersistedState = vi.fn().mockResolvedValue(undefined);
const mockSetLogLevel = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/store-utils', () => ({
	loadPersistedState: (...args: unknown[]) => mockLoadPersistedState(...args),
	savePersistedState: (...args: unknown[]) => mockSavePersistedState(...args),
}));

vi.mock('@/lib/ipc', () => ({
	commands: {
		setLogLevel: (...args: unknown[]) => mockSetLogLevel(...args),
	},
}));

vi.mock('@/lib/async-utils', () => ({
	executeSafeAction: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock('@/lib/logger', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock('@/lib/toast', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe('uiStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadPersistedState.mockResolvedValue({});
	});

	async function freshStore() {
		vi.resetModules();
		const mod = await import('./uiStore.svelte');
		await vi.waitFor(() => {
			expect(mockLoadPersistedState).toHaveBeenCalled();
		});
		return mod.uiStore;
	}

	it('has correct defaults', async () => {
		const store = await freshStore();

		expect(store.sidebarOpen).toBe(true);
		expect(store.onboardingCompleted).toBe(false);
		expect(store.contextMenuEnabled).toBe(false);
		expect(store.telemetryEnabled).toBe(false);
		expect(store.commandPaletteOpen).toBe(false);
		expect(store.logLevel).toBe('error');
		expect(store.autoCheckUpdates).toBe(true);
	});

	it('toggleSidebar flips the sidebar state', async () => {
		const store = await freshStore();

		store.toggleSidebar();
		expect(store.sidebarOpen).toBe(false);

		store.toggleSidebar();
		expect(store.sidebarOpen).toBe(true);
	});

	it('toggleSidebar persists state', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();

		store.toggleSidebar();

		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'ui-storage' }),
			expect.objectContaining({ sidebarOpen: false }),
		);
	});

	it('setSidebarOpen updates and persists', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();

		store.setSidebarOpen(false);

		expect(store.sidebarOpen).toBe(false);
		expect(mockSavePersistedState).toHaveBeenCalled();
	});

	it('setOnboardingCompleted updates and persists', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();

		store.setOnboardingCompleted(true);

		expect(store.onboardingCompleted).toBe(true);
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'ui-storage' }),
			expect.objectContaining({ onboardingCompleted: true }),
		);
	});

	it('setContextMenuEnabled updates and persists', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();

		store.setContextMenuEnabled(true);

		expect(store.contextMenuEnabled).toBe(true);
		expect(mockSavePersistedState).toHaveBeenCalled();
	});

	it('setTelemetryEnabled updates and persists', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();

		store.setTelemetryEnabled(true);

		expect(store.telemetryEnabled).toBe(true);
		expect(mockSavePersistedState).toHaveBeenCalled();
	});

	it('setCommandPaletteOpen accepts boolean', async () => {
		const store = await freshStore();

		store.setCommandPaletteOpen(true);
		expect(store.commandPaletteOpen).toBe(true);

		store.setCommandPaletteOpen(false);
		expect(store.commandPaletteOpen).toBe(false);
	});

	it('setCommandPaletteOpen accepts a function updater', async () => {
		const store = await freshStore();

		store.setCommandPaletteOpen((prev: boolean) => !prev);
		expect(store.commandPaletteOpen).toBe(true);

		store.setCommandPaletteOpen((prev: boolean) => !prev);
		expect(store.commandPaletteOpen).toBe(false);
	});

	it('setLogLevel updates state, persists, and calls backend', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();
		mockSetLogLevel.mockClear();

		store.setLogLevel('debug');

		expect(store.logLevel).toBe('debug');
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'ui-storage' }),
			expect.objectContaining({ logLevel: 'debug' }),
		);
		expect(mockSetLogLevel).toHaveBeenCalledWith('debug');
	});

	it('setAutoCheckUpdates updates state and persists', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();

		store.setAutoCheckUpdates(false);

		expect(store.autoCheckUpdates).toBe(false);
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'ui-storage' }),
			expect.objectContaining({ autoCheckUpdates: false }),
		);
	});

	it('hydrates from persisted state', async () => {
		mockLoadPersistedState.mockResolvedValue({
			sidebarOpen: false,
			onboardingCompleted: true,
			contextMenuEnabled: true,
			telemetryEnabled: true,
			logLevel: 'trace',
			autoCheckUpdates: false,
		});
		const store = await freshStore();

		expect(store.sidebarOpen).toBe(false);
		expect(store.onboardingCompleted).toBe(true);
		expect(store.contextMenuEnabled).toBe(true);
		expect(store.telemetryEnabled).toBe(true);
		expect(store.logLevel).toBe('trace');
		expect(store.autoCheckUpdates).toBe(false);
		expect(store._hasHydrated).toBe(true);
	});

	it('sets _hasHydrated after hydration with empty state', async () => {
		const store = await freshStore();
		expect(store._hasHydrated).toBe(true);
	});

	it('has default activeSettingsTab as general', async () => {
		const store = await freshStore();
		expect(store.activeSettingsTab).toBe('general');
	});

	it('setActiveSettingsTab validates and updates activeSettingsTab', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();

		// valid tab
		store.setActiveSettingsTab('appearance');
		expect(store.activeSettingsTab).toBe('appearance');
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'ui-storage' }),
			expect.objectContaining({ activeSettingsTab: 'appearance' }),
		);

		// invalid tab falls back to general
		store.setActiveSettingsTab('invalid-tab-id');
		expect(store.activeSettingsTab).toBe('general');
	});

	it('hydrates activeSettingsTab from persisted state and validates it', async () => {
		mockLoadPersistedState.mockResolvedValue({
			activeSettingsTab: 'updates',
		});
		let store = await freshStore();
		expect(store.activeSettingsTab).toBe('updates');

		mockLoadPersistedState.mockResolvedValue({
			activeSettingsTab: 'invalid-stored-tab',
		});
		store = await freshStore();
		expect(store.activeSettingsTab).toBe('general');
	});
});
