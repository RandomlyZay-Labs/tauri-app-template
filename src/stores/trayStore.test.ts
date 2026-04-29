import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadPersistedState = vi.fn().mockResolvedValue({});
const mockSavePersistedState = vi.fn().mockResolvedValue(undefined);
const mockSetTraySettings = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/store-utils', () => ({
	loadPersistedState: (...args: unknown[]) => mockLoadPersistedState(...args),
	savePersistedState: (...args: unknown[]) => mockSavePersistedState(...args),
}));

vi.mock('@/lib/ipc', () => ({
	commands: {
		setTraySettings: (...args: unknown[]) => mockSetTraySettings(...args),
	},
}));

describe('trayStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadPersistedState.mockResolvedValue({});
	});

	async function freshStore() {
		vi.resetModules();
		const mod = await import('./trayStore.svelte');
		await vi.waitFor(() => {
			expect(mockLoadPersistedState).toHaveBeenCalled();
		});
		return mod.trayStore;
	}

	it('has correct defaults', async () => {
		const store = await freshStore();

		expect(store.minimizeToTray).toBe(false);
		expect(store.notifyOnMinimize).toBe(true);
	});

	it('setMinimizeToTray updates state and persists', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();
		mockSetTraySettings.mockClear();

		store.setMinimizeToTray(true);

		expect(store.minimizeToTray).toBe(true);
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'tray-settings' }),
			expect.objectContaining({ minimizeToTray: true }),
		);
	});

	it('setMinimizeToTray syncs to backend', async () => {
		const store = await freshStore();
		mockSetTraySettings.mockClear();

		store.setMinimizeToTray(true);

		expect(mockSetTraySettings).toHaveBeenCalledWith(true, true);
	});

	it('setNotifyOnMinimize updates state and persists', async () => {
		const store = await freshStore();
		mockSavePersistedState.mockClear();
		mockSetTraySettings.mockClear();

		store.setNotifyOnMinimize(false);

		expect(store.notifyOnMinimize).toBe(false);
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'tray-settings' }),
			expect.objectContaining({ notifyOnMinimize: false }),
		);
	});

	it('setNotifyOnMinimize syncs to backend', async () => {
		const store = await freshStore();
		mockSetTraySettings.mockClear();

		store.setNotifyOnMinimize(false);

		expect(mockSetTraySettings).toHaveBeenCalledWith(false, false);
	});

	it('hydrates from persisted state', async () => {
		mockLoadPersistedState.mockResolvedValue({
			minimizeToTray: true,
			notifyOnMinimize: false,
		});
		const store = await freshStore();

		expect(store.minimizeToTray).toBe(true);
		expect(store.notifyOnMinimize).toBe(false);
	});

	it('syncs to backend after hydration', async () => {
		mockLoadPersistedState.mockResolvedValue({
			minimizeToTray: true,
			notifyOnMinimize: false,
		});
		await freshStore();

		await vi.waitFor(() => {
			expect(mockSetTraySettings).toHaveBeenCalled();
		});
	});
});
