import { listen } from '@tauri-apps/api/event';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activityStore } from '@/stores/activityStore.svelte';
import { networkStore } from '@/stores/networkStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import { JOB_EVENT_NAME } from '@/types/job';
import { commands } from './ipc';
import { lifecycleManager } from './lifecycle.svelte';
import { captureEvent } from './telemetry';
import { toast } from './toast';

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn().mockResolvedValue(() => {}),
	emit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/core', async (importOriginal) => {
	const original =
		await importOriginal<typeof import('@tauri-apps/api/core')>();
	return {
		...original,
		isTauri: vi.fn().mockReturnValue(true),
	};
});

vi.mock('./ipc', () => ({
	commands: {
		watchPath: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('./logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock('./telemetry', () => ({
	captureEvent: vi.fn(),
}));

vi.mock('./toast', () => ({
	toast: {
		error: vi.fn(),
		message: vi.fn(),
	},
}));

vi.mock('@/stores/activityStore.svelte', () => ({
	activityStore: {
		activities: {},
		upsertActivity: vi.fn(),
	},
}));

vi.mock('@/stores/networkStore.svelte', () => ({
	networkStore: {
		setIsOffline: vi.fn(),
	},
}));

vi.mock('@/stores/uiStore.svelte', () => ({
	uiStore: {
		contextMenuEnabled: false,
	},
}));

vi.mock('@/stores/watcherStore.svelte', () => ({
	watcherStore: {
		watchedPaths: ['/test/path'],
	},
}));

vi.mock('./i18n', () => ({
	t: vi.fn((key, opts) => opts?.defaultValue || key),
}));

describe('LifecycleManager', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		lifecycleManager.destroy();
		vi.useRealTimers();
	});

	it('initializes telemetry and window event listeners', async () => {
		const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

		await lifecycleManager.init();

		expect(captureEvent).toHaveBeenCalledWith('app_start');
		expect(addEventListenerSpy).toHaveBeenCalledWith(
			'online',
			expect.any(Function),
		);
		expect(addEventListenerSpy).toHaveBeenCalledWith(
			'offline',
			expect.any(Function),
		);
		expect(addEventListenerSpy).toHaveBeenCalledWith(
			'contextmenu',
			expect.any(Function),
		);
		expect(addEventListenerSpy).toHaveBeenCalledWith(
			'keydown',
			expect.any(Function),
		);
	});

	it('syncs online/offline events to networkStore', async () => {
		await lifecycleManager.init();

		window.dispatchEvent(new Event('offline'));
		expect(networkStore.setIsOffline).toHaveBeenCalledWith(true);

		window.dispatchEvent(new Event('online'));
		expect(networkStore.setIsOffline).toHaveBeenCalledWith(false);
	});

	it('prevents context menu when disabled', async () => {
		await lifecycleManager.init();
		const event = new Event('contextmenu', { cancelable: true });
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});

	it('allows context menu when enabled', async () => {
		uiStore.contextMenuEnabled = true;
		await lifecycleManager.init();
		const event = new Event('contextmenu', { cancelable: true });
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	});

	it('prevents devtools keyboard shortcuts when disabled', async () => {
		uiStore.contextMenuEnabled = false;
		await lifecycleManager.init();
		const event = new KeyboardEvent('keydown', {
			key: 'F12',
			cancelable: true,
		});
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});

	it('sets up activity sync job listener', async () => {
		await lifecycleManager.init();
		expect(listen).toHaveBeenCalledWith(JOB_EVENT_NAME, expect.any(Function));

		const handler = vi
			.mocked(listen)
			// biome-ignore lint/suspicious/noExplicitAny: test helper
			.mock.calls.find((c) => c[0] === JOB_EVENT_NAME)?.[1] as (e: any) => void;
		handler({
			payload: {
				jobId: 'job-1',
				kind: 'download_file',
				status: 'in_progress',
				percent: 50,
				message: 'Downloading...',
			},
		});
		await tick();

		expect(activityStore.upsertActivity).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'job-1',
				kind: 'download_file',
				label: 'Download File',
				status: 'in_progress',
				progress: 50,
				message: 'Downloading...',
			}),
		);
	});

	it('displays error toast when job fails', async () => {
		await lifecycleManager.init();
		const handler = vi
			.mocked(listen)
			// biome-ignore lint/suspicious/noExplicitAny: test helper
			.mock.calls.find((c) => c[0] === JOB_EVENT_NAME)?.[1] as (e: any) => void;
		handler({
			payload: {
				jobId: 'job-2',
				kind: 'export_data',
				status: 'failed',
				percent: 0,
				message: 'Network error',
			},
		});
		await tick();

		expect(toast.error).toHaveBeenCalledWith(
			'activityCenter.jobFailed',
			expect.objectContaining({
				description: 'Network error',
			}),
		);
	});

	it('sets up file watcher listener and watches paths', async () => {
		await lifecycleManager.init();

		expect(commands.watchPath).toHaveBeenCalledWith('/test/path');
		expect(listen).toHaveBeenCalledWith('fs://change', expect.any(Function));

		const handler = vi
			.mocked(listen)
			// biome-ignore lint/complexity/noBannedTypes: test helper
			.mock.calls.find((c) => c[0] === 'fs://change')?.[1] as Function;
		handler({ payload: '/test/path/file.txt' });
		await tick();

		expect(toast.message).toHaveBeenCalled();
	});

	it('cleans up resources on destroy', async () => {
		const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
		await lifecycleManager.init();
		lifecycleManager.destroy();

		expect(removeEventListenerSpy).toHaveBeenCalledWith(
			'online',
			expect.any(Function),
		);
		expect(removeEventListenerSpy).toHaveBeenCalledWith(
			'offline',
			expect.any(Function),
		);
		expect(removeEventListenerSpy).toHaveBeenCalledWith(
			'contextmenu',
			expect.any(Function),
		);
		expect(removeEventListenerSpy).toHaveBeenCalledWith(
			'keydown',
			expect.any(Function),
		);
		expect(listen).toHaveBeenCalled();
	});
});
