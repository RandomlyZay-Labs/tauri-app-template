// SPDX-License-Identifier: MIT
import { t } from '@/lib/i18n';

/**
 * Maps a backend error type and message to a localized string.
 */
export function mapErrorToI18n(type: string, message: string): string {
	const errorType = type.toLowerCase();

	switch (errorType) {
		case 'database':
			return t('errors.database', { message });
		case 'notfound':
			return t('errors.notFound', { message });
		case 'io':
			return t('errors.io', { message });
		case 'validation':
			return t('errors.validation', { message });
		case 'network':
			return t('errors.network', { message });
		default:
			return message;
	}
}
