import { relaunch } from '@tauri-apps/plugin-process';
import {
	check,
	type DownloadEvent,
	type Update,
} from '@tauri-apps/plugin-updater';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { commands } from '@/lib/ipc';
import { toast } from '@/lib/toast';
import { networkStore } from '@/stores/networkStore.svelte';

export type UpdateStatus =
	| 'idle'
	| 'checking'
	| 'available'
	| 'no-update'
	| 'downloading'
	| 'downloaded'
	| 'error';

class UpdateStore {
	status = $state<UpdateStatus>('idle');
	version = $state<string>('');
	date = $state<string | undefined>(undefined);
	body = $state<string | undefined>(undefined);
	contentLength = $state<number | undefined>(undefined);
	downloadedBytes = $state<number>(0);
	error = $state<string | null>(null);

	activeUpdate = $state<Update | null>(null);
	installType = $state<string>('unknown');

	isPackageManaged = $derived(
		this.installType === 'deb' || this.installType === 'rpm',
	);

	constructor() {
		this.initInstallType();
	}

	private async initInstallType() {
		await executeSafeAction(
			async () => {
				this.installType = await commands.getInstallType();
			},
			{
				silent: true,
			},
		);
	}

	// Derived progress percentage
	percentage = $derived.by(() => {
		if (!this.contentLength || this.contentLength === 0) return 0;
		return Math.round((this.downloadedBytes / this.contentLength) * 100);
	});

	async checkForUpdates(isManual = false) {
		if (networkStore.isOffline) {
			if (isManual) {
				toast.error(t('errors.network', { message: t('common.offline') }));
			}
			return;
		}

		if (this.status === 'checking' || this.status === 'downloading') {
			return;
		}

		this.status = 'checking';
		this.error = null;

		await executeSafeAction(
			async () => {
				const update = await check();
				if (update) {
					this.activeUpdate = update;
					this.version = update.version;
					this.date = update.date;
					this.body = update.body;
					this.status = 'available';

					if (!isManual) {
						toast.message(t('updateSettings.updateAvailableTitle'), {
							description: t('updateSettings.updateAvailableDesc', {
								version: update.version,
							}),
						});
					}
				} else {
					this.status = 'no-update';
					this.activeUpdate = null;
					this.version = '';
					this.date = undefined;
					this.body = undefined;
					if (isManual) {
						toast.success(t('updateSettings.noUpdateTitle'), {
							description: t('updateSettings.noUpdateDesc'),
						});
					}
				}
			},
			{
				silent: !isManual,
				errorMessage: t('updateSettings.checkFailed'),
				onError: (err: unknown) => {
					this.status = 'error';
					this.error = err instanceof Error ? err.message : String(err);
					this.activeUpdate = null;
					this.version = '';
					this.date = undefined;
					this.body = undefined;
				},
			},
		);
	}

	async downloadAndInstallUpdate() {
		const update = this.activeUpdate;
		if (!update) {
			toast.error(t('updateSettings.noActiveUpdate'));
			return;
		}

		this.status = 'downloading';
		this.downloadedBytes = 0;
		this.contentLength = undefined;
		this.error = null;

		await executeSafeAction(
			async () => {
				await update.downloadAndInstall((progress: DownloadEvent) => {
					switch (progress.event) {
						case 'Started':
							this.contentLength = progress.data.contentLength;
							this.downloadedBytes = 0;
							break;
						case 'Progress':
							this.downloadedBytes += progress.data.chunkLength;
							break;
						case 'Finished':
							break;
					}
				});

				this.status = 'downloaded';
				toast.success(t('updateSettings.downloadSuccessTitle'), {
					description: t('updateSettings.downloadSuccessDesc'),
				});
			},
			{
				errorMessage: t('updateSettings.downloadFailed'),
				onError: (err: unknown) => {
					this.status = 'error';
					this.error = err instanceof Error ? err.message : String(err);
				},
			},
		);
	}

	async applyUpdate() {
		await executeSafeAction(
			async () => {
				await relaunch();
			},
			{
				errorMessage: t('debugSettings.failedToRelaunch'),
			},
		);
	}
}

export const updateStore = new UpdateStore();
