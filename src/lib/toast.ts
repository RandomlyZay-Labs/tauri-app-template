// SPDX-License-Identifier: MIT
import { type ExternalToast, toast as sonnerToast } from 'svelte-sonner';
import { logger } from '@/lib/logger';

export type NotificationType =
	| 'success'
	| 'error'
	| 'info'
	| 'warning'
	| 'default';

export interface ToastOptions extends ExternalToast {
	shouldCopy?: boolean;
}

const handleCopy = (text: string) => {
	void navigator.clipboard.writeText(text);
	sonnerToast.success('Copied to clipboard', { duration: 2000 });
};

const notifyAndStore = (
	message: string,
	type: NotificationType,
	data?: ToastOptions,
) => {
	const logMessage = `Toast [${type}]: ${message}${data?.description ? ` - ${data.description}` : ''}`;
	if (type === 'error') {
		void logger.error(logMessage);
	} else if (type === 'warning') {
		void logger.warn(logMessage);
	} else {
		void logger.info(logMessage);
	}

	const hasCopyButton = type === 'error' || data?.shouldCopy;
	const mergedData: ExternalToast = { ...data };
	delete (mergedData as { shouldCopy?: boolean }).shouldCopy;

	const duration = data?.duration || 4000;
	const durationStyle = `--toast-duration: ${duration}ms;`;
	let styleStr = durationStyle;
	if (data?.style) {
		if (typeof data.style === 'string') {
			styleStr = `${data.style}; ${durationStyle}`;
		} else if (typeof data.style === 'object') {
			styleStr = `${Object.entries(data.style)
				.map(([k, v]) => `${k}: ${v};`)
				.join(' ')} ${durationStyle}`;
		}
	}
	mergedData.style = styleStr;

	if (data?.action) {
		mergedData.action = data.action;
	} else if (hasCopyButton) {
		mergedData.action = {
			label: 'Copy',
			onClick: () => handleCopy(message),
		};
	}

	if (type === 'default') {
		return sonnerToast(message, mergedData);
	}
	return sonnerToast[type](message, mergedData);
};

export const toast = {
	success: (message: string, data?: ToastOptions) =>
		notifyAndStore(message, 'success', data),
	error: (message: string, data?: ToastOptions) =>
		notifyAndStore(message, 'error', data),
	info: (message: string, data?: ToastOptions) =>
		notifyAndStore(message, 'info', data),
	warning: (message: string, data?: ToastOptions) =>
		notifyAndStore(message, 'warning', data),
	message: (message: string, data?: ToastOptions) =>
		notifyAndStore(message, 'default', data),
	dismiss: sonnerToast.dismiss,
	promise: sonnerToast.promise,
	custom: sonnerToast.custom,
};
