import { toast as sonnerToast } from 'svelte-sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationStore } from '@/stores/notificationStore.svelte';
import { toast } from './toast';

vi.mock('svelte-sonner', () => ({
	toast: Object.assign(vi.fn(), {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		dismiss: vi.fn(),
		promise: vi.fn(),
		custom: vi.fn(),
	}),
}));

vi.mock('@/stores/notificationStore.svelte', () => ({
	notificationStore: {
		addNotification: vi.fn(),
	},
}));

describe('toast wrapper', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(navigator, 'clipboard', {
			value: {
				writeText: vi.fn().mockResolvedValue(undefined),
			},
			configurable: true,
		});
	});

	it('syncs success toast with notificationStore and sonner', () => {
		toast.success('Success message', { description: 'Detail' });

		expect(notificationStore.addNotification).toHaveBeenCalledWith({
			title: 'Success message',
			description: 'Detail',
			type: 'success',
		});

		expect(sonnerToast.success).toHaveBeenCalledWith(
			'Success message',
			expect.objectContaining({
				description: 'Detail',
			}),
		);
	});

	it('syncs error toast with notificationStore and sonner', () => {
		toast.error('Error message');

		expect(notificationStore.addNotification).toHaveBeenCalledWith({
			title: 'Error message',
			description: undefined,
			type: 'error',
		});

		expect(sonnerToast.error).toHaveBeenCalledWith(
			'Error message',
			expect.any(Object),
		);
	});

	it('syncs info toast with notificationStore and sonner', () => {
		toast.info('Info message');
		expect(notificationStore.addNotification).toHaveBeenCalledWith({
			title: 'Info message',
			description: undefined,
			type: 'info',
		});
		expect(sonnerToast.info).toHaveBeenCalled();
	});

	it('syncs warning toast with notificationStore and sonner', () => {
		toast.warning('Warning message');
		expect(notificationStore.addNotification).toHaveBeenCalledWith({
			title: 'Warning message',
			description: undefined,
			type: 'warning',
		});
		expect(sonnerToast.warning).toHaveBeenCalled();
	});

	it('syncs message (default) toast with notificationStore and sonner', () => {
		toast.message('Default message');
		expect(notificationStore.addNotification).toHaveBeenCalledWith({
			title: 'Default message',
			description: undefined,
			type: 'default',
		});
		expect(sonnerToast).toHaveBeenCalledWith(
			'Default message',
			expect.any(Object),
		);
	});

	it('provides a default copy action that writes to clipboard', async () => {
		toast.success('Test message');

		const callData = vi.mocked(sonnerToast.success).mock.calls[0][1];
		expect(callData?.action?.label).toBe('Copy');

		// Execute the action
		await callData?.action?.onClick?.(new MouseEvent('click'));

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test message');
		expect(sonnerToast.success).toHaveBeenCalledWith('Copied to clipboard', {
			duration: 2000,
		});
	});

	it('exports sonner toast utility functions', () => {
		expect(toast.dismiss).toBeDefined();
		expect(toast.promise).toBeDefined();
		expect(toast.custom).toBeDefined();
	});
});
