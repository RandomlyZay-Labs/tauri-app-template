// SPDX-License-Identifier: MIT
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Activity, activityStore } from '@/stores/activityStore.svelte';
import ActivityCenter from './ActivityCenter.svelte';

vi.mock('@/stores/activityStore.svelte', () => ({
	activityStore: {
		activities: {},
		isOpen: true,
		getSortedActivities: vi.fn(),
		clearCompleted: vi.fn(),
		removeActivity: vi.fn(),
		setIsOpen: vi.fn(),
	},
}));

vi.mock('@/stores/animationStore.svelte', () => ({
	animationStore: {
		animationsEnabled: false,
	},
}));

vi.mock('@/lib/i18n', () => ({
	t: (key: string) => key,
}));

vi.mock('@/lib/utils', () => ({
	cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
	formatDuration: (s: number) => `${s}s`,
	formatSpeed: (s: number) => `${s}/s`,
}));

describe('ActivityCenter', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		activityStore.isOpen = true;
	});

	it('renders empty state when no activities', () => {
		vi.mocked(activityStore.getSortedActivities).mockReturnValue([]);
		render(ActivityCenter);

		expect(screen.getByText('activityCenter.empty')).toBeDefined();
	});

	it('renders activities correctly', () => {
		const mockActivities: Partial<Activity>[] = [
			{
				id: '1',
				label: 'Download file',
				status: 'running',
				progress: 50,
				message: 'Downloading...',
				updatedAt: Date.now(),
			},
			{
				id: '2',
				label: 'Backup',
				status: 'completed',
				progress: 100,
				message: 'Done',
				updatedAt: Date.now() - 1000,
			},
		];
		vi.mocked(activityStore.getSortedActivities).mockReturnValue(
			mockActivities as Activity[],
		);
		render(ActivityCenter);

		expect(screen.getByText('Download file')).toBeDefined();
		expect(screen.getByText('Backup')).toBeDefined();
		expect(screen.getByText('Downloading...')).toBeDefined();
		expect(screen.getByText('activityCenter.statusRunning')).toBeDefined();
		expect(screen.getByText('activityCenter.statusCompleted')).toBeDefined();
	});

	it('clears completed activities', async () => {
		const mockActivities: Partial<Activity>[] = [
			{
				id: '2',
				label: 'Backup',
				status: 'completed',
				progress: 100,
				updatedAt: Date.now(),
			},
		];
		vi.mocked(activityStore.getSortedActivities).mockReturnValue(
			mockActivities as Activity[],
		);
		render(ActivityCenter);

		const clearBtn = screen.getByText('activityCenter.clearCompleted');
		await fireEvent.click(clearBtn);

		expect(activityStore.clearCompleted).toHaveBeenCalled();
	});

	it('removes a specific activity', async () => {
		const mockActivities: Partial<Activity>[] = [
			{
				id: '1',
				label: 'Task',
				status: 'completed',
				updatedAt: Date.now(),
			},
		];
		vi.mocked(activityStore.getSortedActivities).mockReturnValue(
			mockActivities as Activity[],
		);
		render(ActivityCenter);

		const removeBtn = screen.getByLabelText('activityCenter.removeActivity');
		await fireEvent.click(removeBtn);

		expect(activityStore.removeActivity).toHaveBeenCalledWith('1');
	});
});
