import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
	type ActivityStatus,
	activityStore,
} from '@/stores/activityStore.svelte';
import { networkStore } from '@/stores/networkStore.svelte';
import { notificationStore } from '@/stores/notificationStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import { updateStore } from '@/stores/updateStore.svelte';
import { watcherStore } from '@/stores/watcherStore.svelte';
import { JOB_EVENT_NAME, type JobProgress } from '@/types/job';
import { t } from './i18n';
import { commands } from './ipc';
import { captureEvent } from './telemetry';
import { toast } from './toast';

class LifecycleManager {
	private unlistenJob: UnlistenFn | undefined;
	private unlistenFs: UnlistenFn | undefined;
	private handleOnline: (() => void) | undefined;
	private handleOffline: (() => void) | undefined;
	private handleContextMenu: ((e: MouseEvent) => void) | undefined;
	private handleKeyDown: ((e: KeyboardEvent) => void) | undefined;
	private autoCheckTimeout: ReturnType<typeof setTimeout> | undefined;

	async init() {
		// Sync network events
		this.handleOnline = () => networkStore.setIsOffline(false);
		this.handleOffline = () => networkStore.setIsOffline(true);
		window.addEventListener('online', this.handleOnline);
		window.addEventListener('offline', this.handleOffline);

		// Context menu prevention
		this.handleContextMenu = (e: MouseEvent) => {
			if (!uiStore.contextMenuEnabled) {
				e.preventDefault();
			}
		};
		window.addEventListener('contextmenu', this.handleContextMenu);

		// DevTools shortcut prevention
		this.handleKeyDown = (e: KeyboardEvent) => {
			if (!uiStore.contextMenuEnabled) {
				const isF12 = e.key === 'F12';
				const isCtrlShiftI =
					e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i';
				const isCmdOptionI =
					e.metaKey && e.altKey && e.key.toLowerCase() === 'i';

				if (isF12 || isCtrlShiftI || isCmdOptionI) {
					e.preventDefault();
				}
			}
		};
		window.addEventListener('keydown', this.handleKeyDown);

		// Telemetry: Track app startup
		captureEvent('app_start');

		// Auto check for updates on startup if enabled
		if (uiStore.autoCheckUpdates) {
			this.autoCheckTimeout = setTimeout(() => {
				void updateStore.checkForUpdates(false);
			}, 3000);
		}

		// Activity sync: bridge Tauri job events to activity store
		this.unlistenJob = await listen<JobProgress>(JOB_EVENT_NAME, (event) => {
			const p = event.payload;
			const existing = activityStore.activities[p.jobId];
			const labelCap = p.kind
				.replace(/_/g, ' ')
				.replace(/\b\w/g, (c) => c.toUpperCase());

			if (p.status === 'failed' && existing?.status !== 'failed') {
				toast.error(t('activityCenter.jobFailed', { job: labelCap }), {
					description: p.message || t('errors.unknownError'),
				});
			}

			activityStore.upsertActivity({
				id: p.jobId,
				kind: p.kind,
				label: labelCap,
				status: p.status as ActivityStatus,
				progress: p.percent,
				speedBps: p.speedBps != null ? Number(p.speedBps) : null,
				etaSecs: p.etaSecs != null ? Number(p.etaSecs) : null,
				message: p.message,
				createdAt: existing?.createdAt ?? Date.now(),
				updatedAt: Date.now(),
			});
		});

		// File watcher: sync watched paths and listen for changes
		void Promise.all(
			watcherStore.watchedPaths.map((p) =>
				commands.watchPath(p).catch((err: unknown) => {
					console.error(`Failed to watch path ${p}:`, err);
				}),
			),
		);

		this.unlistenFs = await listen<string>('fs://change', (event) => {
			const path = event.payload;
			const message = t('debugSettings.fileChanged', {
				path,
			});

			toast.message(t('debugSettings.fileWatcherEvent'), {
				description: message,
			});

			notificationStore.addNotification({
				title: t('debugSettings.fileWatcherEvent'),
				description: message,
				type: 'info',
			});
		});
	}

	destroy() {
		if (this.autoCheckTimeout) {
			clearTimeout(this.autoCheckTimeout);
		}
		if (this.handleOnline)
			window.removeEventListener('online', this.handleOnline);
		if (this.handleOffline)
			window.removeEventListener('offline', this.handleOffline);
		if (this.handleContextMenu)
			window.removeEventListener('contextmenu', this.handleContextMenu);
		if (this.handleKeyDown)
			window.removeEventListener('keydown', this.handleKeyDown);
		this.unlistenJob?.();
		this.unlistenFs?.();
	}
}

export const lifecycleManager = new LifecycleManager();
