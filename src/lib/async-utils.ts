import { t } from '@/lib/i18n';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';

interface SafeActionOptions {
	/** Custom error message prefix. Defaults to "An unexpected error occurred". */
	errorMessage?: string;
	/** If provided, a success toast will be shown with this message. */
	successMessage?: string;
	/** Callback to run on success. */
	onSuccess?: () => void;
	/** Callback to run on error. */
	onError?: (error: unknown) => void;
}

/**
 * Executes an async action with standardized error handling, logging, and toast notifications.
 *
 * @example
 * void executeSafeAction(async () => {
 *   await apiCall();
 * }, { successMessage: 'Done!', errorMessage: 'Failed' });
 */
export async function executeSafeAction<T>(
	action: () => Promise<T>,
	options: SafeActionOptions = {},
): Promise<T | undefined> {
	const {
		errorMessage = t('errors.unexpectedError'),
		successMessage,
		onSuccess,
		onError,
	} = options;

	try {
		void logger.debug('[executeSafeAction] Starting action');
		const result = await action();
		void logger.debug('[executeSafeAction] Action succeeded');
		if (successMessage) {
			toast.success(successMessage);
		}
		onSuccess?.();
		return result;
	} catch (error) {
		let message: string;

		if (error instanceof Error) {
			message = error.message;
		} else if (
			typeof error === 'object' &&
			error !== null &&
			'message' in error &&
			typeof (error as { message: unknown }).message === 'string'
		) {
			message = (error as { message: string }).message;
		} else {
			message = String(error);
		}

		void logger.error(errorMessage, error);
		toast.error(`${errorMessage}: ${message}`);
		onError?.(error);
		return undefined;
	}
}
