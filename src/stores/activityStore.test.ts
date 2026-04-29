// SPDX-License-Identifier: MIT
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Activity, activityStore } from './activityStore.svelte';

vi.mock('@/lib/logger', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		trace: vi.fn(),
	},
}));

function makeActivity(overrides: Partial<Activity> = {}): Activity {
	return {
		id: 'test-1',
		kind: 'download',
		label: 'Download',
		status: 'pending',
		progress: null,
		message: null,
		createdAt: 1000,
		updatedAt: 1000,
		...overrides,
	};
}

describe('activityStore', () => {
	beforeEach(() => {
		activityStore.activities = {};
	});

	it('upserts a new activity', () => {
		const activity = makeActivity();
		activityStore.upsertActivity(activity);

		expect(activityStore.activities['test-1']).toEqual(activity);
	});

	it('upserts an existing activity (update)', () => {
		activityStore.upsertActivity(makeActivity());
		const updated = makeActivity({ status: 'running', progress: 50 });
		activityStore.upsertActivity(updated);

		const stored = activityStore.activities['test-1'];
		expect(stored.status).toBe('running');
		expect(stored.progress).toBe(50);
	});

	it('removes an activity by id', () => {
		activityStore.upsertActivity(makeActivity({ id: 'a1' }));
		activityStore.upsertActivity(makeActivity({ id: 'a2' }));

		activityStore.removeActivity('a1');

		const activities = activityStore.activities;
		expect(activities.a1).toBeUndefined();
		expect(activities.a2).toBeDefined();
	});

	it('clearCompleted removes completed, failed, cancelled, and interrupted', () => {
		activityStore.upsertActivity(
			makeActivity({ id: 'running', status: 'running' }),
		);
		activityStore.upsertActivity(
			makeActivity({ id: 'completed', status: 'completed' }),
		);
		activityStore.upsertActivity(
			makeActivity({ id: 'failed', status: 'failed' }),
		);
		activityStore.upsertActivity(
			makeActivity({ id: 'cancelled', status: 'cancelled' }),
		);
		activityStore.upsertActivity(
			makeActivity({ id: 'interrupted', status: 'interrupted' }),
		);
		activityStore.upsertActivity(
			makeActivity({ id: 'pending', status: 'pending' }),
		);

		activityStore.clearCompleted();

		const remaining = Object.keys(activityStore.activities);
		expect(remaining).toEqual(expect.arrayContaining(['running', 'pending']));
		expect(remaining).toHaveLength(2);
	});

	it('getSortedActivities returns activities sorted by updatedAt descending', () => {
		activityStore.upsertActivity(makeActivity({ id: 'old', updatedAt: 100 }));
		activityStore.upsertActivity(makeActivity({ id: 'new', updatedAt: 300 }));
		activityStore.upsertActivity(makeActivity({ id: 'mid', updatedAt: 200 }));

		const sorted = activityStore.getSortedActivities();
		expect(sorted.map((a) => a.id)).toEqual(['new', 'mid', 'old']);
	});

	it('toggles isOpen state', () => {
		expect(activityStore.isOpen).toBe(false);
		activityStore.setIsOpen(true);
		expect(activityStore.isOpen).toBe(true);
	});
});
