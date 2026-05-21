import type { Update } from '@tauri-apps/plugin-updater';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { networkStore } from '@/stores/networkStore.svelte';
import type { UpdateStatus } from './updateStore.svelte';

// Mock Tauri plugin-updater and plugin-process
const mockCheck = vi.fn();
const mockRelaunch = vi.fn();

vi.mock('@tauri-apps/plugin-updater', () => ({
	check: () => mockCheck(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
	relaunch: () => mockRelaunch(),
}));

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string, params?: Record<string, unknown>) => {
		if (params) {
			return `${key}:${JSON.stringify(params)}`;
		}
		return key;
	}),
}));

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastMessage = vi.fn();
vi.mock('@/lib/toast', () => ({
	toast: {
		success: (...args: unknown[]) => mockToastSuccess(...args),
		error: (...args: unknown[]) => mockToastError(...args),
		message: (...args: unknown[]) => mockToastMessage(...args),
	},
}));

describe('updateStore', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		networkStore.isOffline = false;

		// Reset updater status to idle/defaults
		const { updateStore } = await import('./updateStore.svelte');
		updateStore.status = 'idle';
		updateStore.version = '';
		updateStore.date = undefined;
		updateStore.body = undefined;
		updateStore.contentLength = undefined;
		updateStore.downloadedBytes = 0;
		updateStore.error = null;
		updateStore.activeUpdate = null;
	});

	async function getStore() {
		const mod = await import('./updateStore.svelte');
		return mod.updateStore;
	}

	it('has correct defaults', async () => {
		const store = await getStore();
		const expectedStatus: UpdateStatus = 'idle';
		expect(store.status).toBe(expectedStatus);
		expect(store.version).toBe('');
		expect(store.date).toBeUndefined();
		expect(store.body).toBeUndefined();
		expect(store.contentLength).toBeUndefined();
		expect(store.downloadedBytes).toBe(0);
		expect(store.error).toBeNull();
		expect(store.activeUpdate).toBeNull();
		expect(store.percentage).toBe(0);
	});

	it('does not check for updates if network is offline', async () => {
		const store = await getStore();
		networkStore.isOffline = true;

		await store.checkForUpdates(false);

		expect(store.status).toBe('idle');
		expect(mockToastError).not.toHaveBeenCalled();

		await store.checkForUpdates(true); // manual check
		expect(store.status).toBe('idle');
		expect(mockToastError).toHaveBeenCalledWith(
			'errors.network:{"message":"common.offline"}',
		);
	});

	it('sets checking status and handles no update found', async () => {
		const store = await getStore();
		mockCheck.mockResolvedValue(null);

		await store.checkForUpdates(false);

		expect(store.status).toBe('no-update');
		expect(store.activeUpdate).toBeNull();
		expect(mockToastSuccess).not.toHaveBeenCalled();

		// Manual check
		await store.checkForUpdates(true);
		expect(store.status).toBe('no-update');
		expect(mockToastSuccess).toHaveBeenCalledWith(
			'updateSettings.noUpdateTitle',
			{
				description: 'updateSettings.noUpdateDesc',
			},
		);
	});

	it('sets available status and values when update is found', async () => {
		const store = await getStore();
		const mockUpdate = {
			version: '2.0.0',
			date: '2026-05-21',
			body: 'New cool features',
			downloadAndInstall: vi.fn(),
		};
		mockCheck.mockResolvedValue(mockUpdate as unknown as Update);

		await store.checkForUpdates(false);

		expect(store.status).toBe('available');
		expect(store.activeUpdate).toEqual(mockUpdate);
		expect(store.version).toBe('2.0.0');
		expect(store.date).toBe('2026-05-21');
		expect(store.body).toBe('New cool features');
		expect(mockToastMessage).toHaveBeenCalledWith(
			'updateSettings.updateAvailableTitle',
			{
				description: 'updateSettings.updateAvailableDesc:{"version":"2.0.0"}',
			},
		);
	});

	it('handles update check failure', async () => {
		const store = await getStore();
		const testError = new Error('Connection refused');
		mockCheck.mockRejectedValue(testError);

		await store.checkForUpdates(true);

		expect(store.status).toBe('error');
		expect(store.error).toBe('Connection refused');
		expect(store.activeUpdate).toBeNull();
		expect(mockToastError).toHaveBeenCalledWith('updateSettings.checkFailed', {
			description: 'Connection refused',
		});
	});

	it('fails downloadAndInstallUpdate if no active update exists', async () => {
		const store = await getStore();
		await store.downloadAndInstallUpdate();
		expect(mockToastError).toHaveBeenCalledWith(
			'updateSettings.noActiveUpdate',
		);
	});

	it('tracks download progress and finishes successfully', async () => {
		const store = await getStore();
		const mockUpdate = {
			version: '2.0.0',
			downloadAndInstall: vi.fn().mockImplementation(async (cb) => {
				cb({ event: 'Started', data: { contentLength: 1000 } });
				cb({ event: 'Progress', data: { chunkLength: 250 } });
				cb({ event: 'Progress', data: { chunkLength: 500 } });
				cb({ event: 'Finished' });
			}),
		};
		store.activeUpdate = mockUpdate as unknown as Update;

		const downloadPromise = store.downloadAndInstallUpdate();
		await downloadPromise;

		expect(store.status).toBe('downloaded');
		expect(store.contentLength).toBe(1000);
		expect(store.downloadedBytes).toBe(750);
		expect(store.percentage).toBe(75);
		expect(mockToastSuccess).toHaveBeenCalledWith(
			'updateSettings.downloadSuccessTitle',
			{
				description: 'updateSettings.downloadSuccessDesc',
			},
		);
	});

	it('handles download failure', async () => {
		const store = await getStore();
		const mockUpdate = {
			version: '2.0.0',
			downloadAndInstall: vi.fn().mockRejectedValue(new Error('Disk full')),
		};
		store.activeUpdate = mockUpdate as unknown as Update;

		await store.downloadAndInstallUpdate();

		expect(store.status).toBe('error');
		expect(store.error).toBe('Disk full');
		expect(mockToastError).toHaveBeenCalledWith(
			'updateSettings.downloadFailed',
			{
				description: 'Disk full',
			},
		);
	});

	it('invokes relaunch when applying update', async () => {
		const store = await getStore();
		await store.applyUpdate();
		expect(mockRelaunch).toHaveBeenCalled();
	});

	it('handles relaunch failure gracefully', async () => {
		const store = await getStore();
		mockRelaunch.mockRejectedValue(new Error('Permission denied'));

		await store.applyUpdate();

		expect(mockToastError).toHaveBeenCalledWith(
			'debugSettings.failedToRelaunch',
			{
				description: 'Permission denied',
			},
		);
	});
});
