import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationStore } from './notificationStore.svelte';

describe('notificationStore', () => {
	beforeEach(() => {
		notificationStore.notifications = [];
		notificationStore.isOpen = false;
	});

	it('defaults to closed with no notifications', () => {
		expect(notificationStore.isOpen).toBe(false);
		expect(notificationStore.notifications).toEqual([]);
	});

	it('setIsOpen toggles the open state', () => {
		notificationStore.setIsOpen(true);
		expect(notificationStore.isOpen).toBe(true);

		notificationStore.setIsOpen(false);
		expect(notificationStore.isOpen).toBe(false);
	});

	it('addNotification inserts at the beginning', () => {
		notificationStore.addNotification({
			title: 'First',
			type: 'info',
		});
		notificationStore.addNotification({
			title: 'Second',
			type: 'success',
		});

		expect(notificationStore.notifications).toHaveLength(2);
		expect(notificationStore.notifications[0].title).toBe('Second');
		expect(notificationStore.notifications[1].title).toBe('First');
	});

	it('addNotification assigns id and createdAt', () => {
		notificationStore.addNotification({
			title: 'Test',
			type: 'error',
			description: 'Details',
		});

		const notification = notificationStore.notifications[0];
		expect(notification.id).toBeDefined();
		expect(typeof notification.id).toBe('string');
		expect(notification.createdAt).toBeGreaterThan(0);
		expect(notification.description).toBe('Details');
	});

	it('caps notifications at 100', () => {
		for (let i = 0; i < 110; i++) {
			notificationStore.addNotification({
				title: `Notification ${i}`,
				type: 'default',
			});
		}

		expect(notificationStore.notifications).toHaveLength(100);
		expect(notificationStore.notifications[0].title).toBe('Notification 109');
	});

	it('clearAll removes all notifications', () => {
		notificationStore.addNotification({ title: 'A', type: 'info' });
		notificationStore.addNotification({ title: 'B', type: 'warning' });

		notificationStore.clearAll();

		expect(notificationStore.notifications).toEqual([]);
	});

	it('preserves existing notifications when adding', () => {
		notificationStore.addNotification({ title: 'Existing', type: 'info' });
		const existingId = notificationStore.notifications[0].id;

		notificationStore.addNotification({ title: 'New', type: 'success' });

		expect(notificationStore.notifications).toHaveLength(2);
		expect(
			notificationStore.notifications.find((n) => n.id === existingId),
		).toBeDefined();
	});

	it('generates unique ids for each notification', () => {
		const uuidSpy = vi.spyOn(crypto, 'randomUUID');

		notificationStore.addNotification({ title: 'A', type: 'info' });
		notificationStore.addNotification({ title: 'B', type: 'info' });

		const ids = notificationStore.notifications.map((n) => n.id);
		expect(new Set(ids).size).toBe(2);

		uuidSpy.mockRestore();
	});
});
