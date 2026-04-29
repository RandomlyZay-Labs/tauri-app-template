import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadPersistedState = vi.fn().mockResolvedValue({});
const mockSavePersistedState = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/store-utils', () => ({
	loadPersistedState: (...args: unknown[]) => mockLoadPersistedState(...args),
	savePersistedState: (...args: unknown[]) => mockSavePersistedState(...args),
}));

describe('backupStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadPersistedState.mockResolvedValue({});
	});

	async function freshStore() {
		vi.resetModules();
		const mod = await import('./backupStore.svelte');
		await vi.waitFor(() => {
			expect(mockLoadPersistedState).toHaveBeenCalled();
		});
		return { store: mod.backupStore, BACKUP_INTERVALS: mod.BACKUP_INTERVALS };
	}

	it('has correct defaults', async () => {
		const { store, BACKUP_INTERVALS } = await freshStore();

		expect(store.enabled).toBe(true);
		expect(store.interval).toBe(BACKUP_INTERVALS.DAILY);
		expect(store.maxBackups).toBe(5);
		expect(store.lastBackupTime).toBeNull();
		expect(store.isBackingUp).toBe(false);
	});

	it('setEnabled updates state and persists', async () => {
		const { store } = await freshStore();
		mockSavePersistedState.mockClear();

		store.setEnabled(false);

		expect(store.enabled).toBe(false);
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'backup-settings' }),
			expect.objectContaining({ enabled: false }),
		);
	});

	it('setInterval updates state and persists', async () => {
		const { store, BACKUP_INTERVALS } = await freshStore();
		mockSavePersistedState.mockClear();

		store.setInterval(BACKUP_INTERVALS.WEEKLY);

		expect(store.interval).toBe(BACKUP_INTERVALS.WEEKLY);
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'backup-settings' }),
			expect.objectContaining({ interval: BACKUP_INTERVALS.WEEKLY }),
		);
	});

	it('setMaxBackups updates state and persists', async () => {
		const { store } = await freshStore();
		mockSavePersistedState.mockClear();

		store.setMaxBackups(10);

		expect(store.maxBackups).toBe(10);
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'backup-settings' }),
			expect.objectContaining({ maxBackups: 10 }),
		);
	});

	it('setLastBackupTime updates state and persists', async () => {
		const { store } = await freshStore();
		mockSavePersistedState.mockClear();

		store.setLastBackupTime(123456);

		expect(store.lastBackupTime).toBe(123456);
		expect(mockSavePersistedState).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'backup-settings' }),
			expect.objectContaining({ lastBackupTime: 123456 }),
		);
	});

	it('setIsBackingUp updates state without persisting', async () => {
		const { store } = await freshStore();
		mockSavePersistedState.mockClear();

		store.setIsBackingUp(true);

		expect(store.isBackingUp).toBe(true);
		expect(mockSavePersistedState).not.toHaveBeenCalled();
	});

	it('hydrates from persisted state', async () => {
		mockLoadPersistedState.mockResolvedValue({
			enabled: false,
			interval: 3600 * 1000,
			maxBackups: 20,
			lastBackupTime: 999999,
		});
		const { store, BACKUP_INTERVALS } = await freshStore();

		expect(store.enabled).toBe(false);
		expect(store.interval).toBe(BACKUP_INTERVALS.HOURLY);
		expect(store.maxBackups).toBe(20);
		expect(store.lastBackupTime).toBe(999999);
		expect(store._hasHydrated).toBe(true);
	});

	it('sets _hasHydrated after hydration even with empty state', async () => {
		const { store } = await freshStore();
		expect(store._hasHydrated).toBe(true);
	});
});
