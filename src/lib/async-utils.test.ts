// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
	logger: {
		debug: vi.fn(() => Promise.resolve()),
		error: vi.fn(() => Promise.resolve()),
		info: vi.fn(() => Promise.resolve()),
		warn: vi.fn(() => Promise.resolve()),
		trace: vi.fn(() => Promise.resolve()),
	},
}));

vi.mock('@/lib/toast', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		message: vi.fn(),
	},
}));

vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key) => `translated-${key}`),
}));

import { executeSafeAction } from '@/lib/async-utils';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('executeSafeAction', () => {
	it('executes the action and logs debug messages on success', async () => {
		const action = vi.fn().mockResolvedValue(undefined);

		await executeSafeAction(action);

		expect(action).toHaveBeenCalledOnce();
		expect(logger.debug).toHaveBeenCalledWith(
			'[executeSafeAction] Starting action',
		);
		expect(logger.debug).toHaveBeenCalledWith(
			'[executeSafeAction] Action succeeded',
		);
	});

	it('shows a success toast when successMessage is provided', async () => {
		const action = vi.fn().mockResolvedValue(undefined);

		await executeSafeAction(action, { successMessage: 'It worked!' });

		expect(toast.success).toHaveBeenCalledWith('It worked!');
	});

	it('does not show a success toast when successMessage is omitted', async () => {
		const action = vi.fn().mockResolvedValue(undefined);

		await executeSafeAction(action);

		expect(toast.success).not.toHaveBeenCalled();
	});

	it('calls onSuccess callback after a successful action', async () => {
		const action = vi.fn().mockResolvedValue(undefined);
		const onSuccess = vi.fn();

		await executeSafeAction(action, { onSuccess });

		expect(onSuccess).toHaveBeenCalledOnce();
	});

	it('catches errors from the action and shows an error toast with default prefix', async () => {
		const action = vi.fn().mockRejectedValue(new Error('connection refused'));

		await executeSafeAction(action);

		expect(toast.error).toHaveBeenCalledWith(
			'translated-errors.unexpectedError: connection refused',
		);
		expect(logger.error).toHaveBeenCalledWith(
			'translated-errors.unexpectedError',
			expect.any(Error),
		);
	});

	it('uses a custom errorMessage prefix when provided', async () => {
		const action = vi.fn().mockRejectedValue(new Error('timeout'));

		await executeSafeAction(action, { errorMessage: 'Fetch failed' });

		expect(toast.error).toHaveBeenCalledWith('Fetch failed: timeout');
		expect(logger.error).toHaveBeenCalledWith(
			'Fetch failed',
			expect.any(Error),
		);
	});

	it('suppresses error toasts when silent option is true', async () => {
		const action = vi.fn().mockRejectedValue(new Error('connection refused'));

		await executeSafeAction(action, { silent: true });

		expect(toast.error).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith(
			'translated-errors.unexpectedError',
			expect.any(Error),
		);
	});

	it('suppresses error toasts when hideErrorToast option is true', async () => {
		const action = vi.fn().mockRejectedValue(new Error('connection refused'));

		await executeSafeAction(action, { hideErrorToast: true });

		expect(toast.error).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith(
			'translated-errors.unexpectedError',
			expect.any(Error),
		);
	});

	it('calls onError callback when the action throws', async () => {
		const error = new Error('boom');
		const action = vi.fn().mockRejectedValue(error);
		const onError = vi.fn();

		await executeSafeAction(action, { onError });

		expect(onError).toHaveBeenCalledWith(error);
	});

	it('does not call onSuccess when the action throws', async () => {
		const action = vi.fn().mockRejectedValue(new Error('fail'));
		const onSuccess = vi.fn();

		await executeSafeAction(action, { onSuccess });

		expect(onSuccess).not.toHaveBeenCalled();
	});

	it('handles an error object with a message property but not an Error instance', async () => {
		const errorObj = { message: 'structured error' };
		const action = vi.fn().mockRejectedValue(errorObj);

		await executeSafeAction(action);

		expect(toast.error).toHaveBeenCalledWith(
			'translated-errors.unexpectedError: structured error',
		);
	});

	it('handles a non-object error by stringifying it', async () => {
		const action = vi.fn().mockRejectedValue('string error');

		await executeSafeAction(action);

		expect(toast.error).toHaveBeenCalledWith(
			'translated-errors.unexpectedError: string error',
		);
	});

	it('handles a number thrown as an error', async () => {
		const action = vi.fn().mockRejectedValue(42);

		await executeSafeAction(action);

		expect(toast.error).toHaveBeenCalledWith(
			'translated-errors.unexpectedError: 42',
		);
	});

	it('handles null thrown as an error', async () => {
		const action = vi.fn().mockRejectedValue(null);

		await executeSafeAction(action);

		expect(toast.error).toHaveBeenCalledWith(
			'translated-errors.unexpectedError: null',
		);
	});

	it('uses default options when none are provided', async () => {
		const action = vi.fn().mockResolvedValue('result');

		await executeSafeAction(action);

		expect(action).toHaveBeenCalledOnce();
		expect(toast.success).not.toHaveBeenCalled();
		expect(toast.error).not.toHaveBeenCalled();
	});

	it('returns the resolved value of the action on success', async () => {
		const action = vi.fn().mockResolvedValue('success-value');

		const result = await executeSafeAction(action);

		expect(result).toBe('success-value');
	});

	it('returns undefined when the action throws an error', async () => {
		const action = vi.fn().mockRejectedValue(new Error('failure'));

		const result = await executeSafeAction(action);

		expect(result).toBeUndefined();
	});
});
