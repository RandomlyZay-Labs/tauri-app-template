import { type ExternalToast, toast as sonnerToast } from 'svelte-sonner';
import { logger } from '@/lib/logger';

export type NotificationType =
	| 'success'
	| 'error'
	| 'info'
	| 'warning'
	| 'default';

const handleCopy = (text: string) => {
	void navigator.clipboard.writeText(text);
	sonnerToast.success('Copied to clipboard', { duration: 2000 });
};

const notifyAndStore = (
	message: string,
	type: NotificationType,
	data?: ExternalToast,
) => {
	const logMessage = `Toast [${type}]: ${message}${data?.description ? ` - ${data.description}` : ''}`;
	if (type === 'error') {
		void logger.error(logMessage);
	} else if (type === 'warning') {
		void logger.warn(logMessage);
	} else {
		void logger.info(logMessage);
	}

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
