import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animationStore } from '@/stores/animationStore.svelte';
import { notificationStore } from '@/stores/notificationStore.svelte';
import NotificationsSheet from './NotificationsSheet.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string) => key),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
	formatDistanceToNow: vi.fn(() => 'just now'),
}));

describe('NotificationsSheet', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		notificationStore.clearAll();
		notificationStore.setIsOpen(false);
		animationStore.setAnimationsEnabled(false);
	});

	afterEach(async () => {
		cleanup();
		notificationStore.setIsOpen(false);
		await tick();
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	it('renders empty state when there are no notifications', async () => {
		notificationStore.setIsOpen(true);
		render(NotificationsSheet);

		expect(screen.getByText('notifications.empty')).toBeTruthy();
	});

	it('renders notifications when they exist', async () => {
		notificationStore.addNotification({
			title: 'Test Notification',
			description: 'Test Description',
			type: 'info',
		});
		notificationStore.setIsOpen(true);
		render(NotificationsSheet);

		expect(screen.getByText('Test Notification')).toBeTruthy();
		expect(screen.getByText('Test Description')).toBeTruthy();
	});

	it('marks a notification as read when clicking the dot', async () => {
		notificationStore.addNotification({
			title: 'Unread Notification',
			type: 'info',
		});
		notificationStore.setIsOpen(true);
		render(NotificationsSheet);

		const markAsReadButton = screen.getByLabelText('notifications.markAsRead');
		await fireEvent.click(markAsReadButton);

		expect(notificationStore.notifications[0].isRead).toBe(true);
	});

	it('marks all as read when clicking the button', async () => {
		notificationStore.addNotification({ title: 'Notif 1', type: 'info' });
		notificationStore.addNotification({ title: 'Notif 2', type: 'info' });
		notificationStore.setIsOpen(true);
		render(NotificationsSheet);

		const markAllButton = screen.getByText('notifications.markAllAsRead');
		await fireEvent.click(markAllButton);

		expect(notificationStore.notifications.every((n) => n.isRead)).toBe(true);
	});

	it('clears all notifications when clicking the clear button', async () => {
		notificationStore.addNotification({ title: 'To be cleared', type: 'info' });
		notificationStore.setIsOpen(true);
		render(NotificationsSheet);

		const clearAllButton = screen.getByText('notifications.clearAll');
		await fireEvent.click(clearAllButton);

		expect(notificationStore.notifications.length).toBe(0);
		expect(screen.getByText('notifications.empty')).toBeTruthy();
	});
});
