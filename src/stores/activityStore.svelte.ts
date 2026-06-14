// SPDX-License-Identifier: MIT
import { logger } from '@/lib/logger';
import {
	loadPersistedState,
	type PersistConfig,
	savePersistedState,
} from '@/lib/store-utils';

export type ActivityStatus =
	| 'pending'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled'
	| 'interrupted';

export interface Activity {
	id: string;
	kind: string;
	label: string;
	status: ActivityStatus;
	progress: number | null;
	speedBps: number | null;
	etaSecs: number | null;
	message: string | null;
	createdAt: number;
	updatedAt: number;
}

const TERMINAL_STATUSES: ReadonlySet<ActivityStatus> = new Set([
	'completed',
	'failed',
	'cancelled',
	'interrupted',
]);

interface ActivityPersistedState {
	activities: Record<string, Activity>;
}

const persistConfig: PersistConfig<ActivityPersistedState> = {
	name: 'activity-storage',
};

class ActivityStore {
	activities = $state<Record<string, Activity>>({});
	isOpen = $state(false);

	constructor() {
		this.hydrate();
	}

	private async hydrate() {
		const saved = await loadPersistedState(persistConfig);
		if (saved.activities) {
			const now = Date.now();
			const patched: Record<string, Activity> = {};

			for (const [id, activity] of Object.entries(saved.activities)) {
				if (activity.status === 'pending' || activity.status === 'running') {
					patched[id] = {
						...activity,
						status: 'interrupted',
						progress: null,
						speedBps: null,
						etaSecs: null,
						updatedAt: now,
					};
				} else {
					patched[id] = activity;
				}
			}

			this.activities = patched;
		}
	}

	private persist() {
		void savePersistedState(persistConfig, {
			activities: this.activities,
		});
	}

	upsertActivity(activity: Activity) {
		void logger.debug('[ActivityStore] Upserting activity', {
			id: activity.id,
			status: activity.status,
		});
		this.activities = { ...this.activities, [activity.id]: activity };
		this.persist();
	}

	async cancelActivity(id: string) {
		void logger.debug('[ActivityStore] Cancelling activity', { id });
		try {
			const { commands } = await import('@/lib/ipc');
			await commands.cancelJob(id);
		} catch (error) {
			void logger.error('[ActivityStore] Failed to cancel activity', error);
		}
	}

	removeActivity(id: string) {
		void logger.debug('[ActivityStore] Removing activity', { id });
		const { [id]: _, ...rest } = this.activities;
		this.activities = rest;
		this.persist();
	}

	clearCompleted() {
		const kept: Record<string, Activity> = {};
		for (const [id, activity] of Object.entries(this.activities)) {
			if (!TERMINAL_STATUSES.has(activity.status)) {
				kept[id] = activity;
			}
		}
		this.activities = kept;
		this.persist();
	}

	setIsOpen(open: boolean) {
		this.isOpen = open;
	}

	getSortedActivities(): Activity[] {
		return Object.values(this.activities).sort(
			(a, b) => b.updatedAt - a.updatedAt,
		);
	}
}

export const activityStore = new ActivityStore();
