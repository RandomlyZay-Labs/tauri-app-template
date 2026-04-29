export type NotificationType =
	| 'success'
	| 'error'
	| 'info'
	| 'warning'
	| 'default';

interface AppNotification {
	id: string;
	title: string;
	description?: string;
	type: NotificationType;
	createdAt: number;
	isRead: boolean;
}

class NotificationStore {
	isOpen = $state(false);
	notifications = $state<AppNotification[]>([]);

	setIsOpen(isOpen: boolean) {
		this.isOpen = isOpen;
	}

	addNotification(
		notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>,
	) {
		const newNotification: AppNotification = {
			...notification,
			id: crypto.randomUUID(),
			createdAt: Date.now(),
			isRead: false,
		};
		this.notifications = [newNotification, ...this.notifications].slice(0, 100);
	}

	markAsRead(id: string) {
		const notif = this.notifications.find((n) => n.id === id);
		if (notif) {
			notif.isRead = true;
		}
	}

	markAllAsRead() {
		for (const notif of this.notifications) {
			notif.isRead = true;
		}
	}

	clearAll() {
		this.notifications = [];
	}
}

export const notificationStore = new NotificationStore();
