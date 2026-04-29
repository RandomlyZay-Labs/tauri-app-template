import { type ExternalToast, toast as sonnerToast } from 'svelte-sonner';
import {
	type NotificationType,
	notificationStore,
} from '@/stores/notificationStore.svelte';

const handleCopy = (text: string) => {
	void navigator.clipboard.writeText(text);
	sonnerToast.success('Copied to clipboard', { duration: 2000 });
};

const notifyAndStore = (
	message: string,
	type: NotificationType,
	data?: ExternalToast,
) => {
	notificationStore.addNotification({
		title: message,
		description:
			typeof data?.description === 'string' ? data.description : undefined,
		type,
	});

	const mergedData: ExternalToast = {
		...data,
		action: data?.action || {
			label: 'Copy',
			onClick: () => handleCopy(message),
		},
	};

	if (type === 'default') {
		return sonnerToast(message, mergedData);
	}
	return sonnerToast[type](message, mergedData);
};

export const toast = {
	success: (message: string, data?: ExternalToast) =>
		notifyAndStore(message, 'success', data),
	error: (message: string, data?: ExternalToast) =>
		notifyAndStore(message, 'error', data),
	info: (message: string, data?: ExternalToast) =>
		notifyAndStore(message, 'info', data),
	warning: (message: string, data?: ExternalToast) =>
		notifyAndStore(message, 'warning', data),
	message: (message: string, data?: ExternalToast) =>
		notifyAndStore(message, 'default', data),
	dismiss: sonnerToast.dismiss,
	promise: sonnerToast.promise,
	custom: sonnerToast.custom,
};
