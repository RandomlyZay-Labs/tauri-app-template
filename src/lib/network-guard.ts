// SPDX-License-Identifier: MIT
import { t } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { networkStore } from '@/stores/networkStore.svelte';

/**
 * Network-aware action guard.
 * Short-circuits with an offline toast when the device has no network connectivity.
 */
export function guardAction<T>(action: () => T): T | undefined {
	if (networkStore.isOffline) {
		toast.warning(t('common.offline'));
		return undefined;
	}
	return action();
}
