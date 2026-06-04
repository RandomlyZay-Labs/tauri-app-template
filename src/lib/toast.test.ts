import { toast as sonnerToast } from 'svelte-sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';
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

vi.mock('./logger', () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
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

	it('syncs success toast with logger and sonner', () => {
		toast.success('Success message', { description: 'Detail' });

		expect(logger.info).toHaveBeenCalledWith(
			'Toast [success]: Success message - Detail',
		);

		expect(sonnerToast.success).toHaveBeenCalledWith(
			'Success message',
			expect.objectContaining({
				description: 'Detail',
			}),
		);
	});

	it('syncs error toast with logger and sonner', () => {
		toast.error('Error message');

		expect(logger.error).toHaveBeenCalledWith('Toast [error]: Error message');

		expect(sonnerToast.error).toHaveBeenCalledWith(
			'Error message',
			expect.any(Object),
		);
	});

	it('syncs info toast with logger and sonner', () => {
		toast.info('Info message');
		expect(logger.info).toHaveBeenCalledWith('Toast [info]: Info message');
		expect(sonnerToast.info).toHaveBeenCalled();
	});

	it('syncs warning toast with logger and sonner', () => {
		toast.warning('Warning message');
		expect(logger.warn).toHaveBeenCalledWith(
			'Toast [warning]: Warning message',
		);
		expect(sonnerToast.warning).toHaveBeenCalled();
	});

	it('syncs message (default) toast with logger and sonner', () => {
		toast.message('Default message');
		expect(logger.info).toHaveBeenCalledWith(
			'Toast [default]: Default message',
		);
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
