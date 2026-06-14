// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
	t: vi.fn(
		(key: string, options?: Record<string, unknown>): string =>
			`[${key}]${options ? JSON.stringify(options) : ''}`,
	),
}));

import { mapErrorToI18n } from '@/lib/error-utils';
import { t } from '@/lib/i18n';

describe('mapErrorToI18n', () => {
	it('maps "database" type to errors.database i18n key', () => {
		const result = mapErrorToI18n('database', 'connection lost');

		expect(t).toHaveBeenCalledWith('errors.database', {
			message: 'connection lost',
		});
		expect(result).toBe('[errors.database]{"message":"connection lost"}');
	});

	it('maps "notfound" type to errors.notFound i18n key', () => {
		const result = mapErrorToI18n('notfound', 'record missing');

		expect(t).toHaveBeenCalledWith('errors.notFound', {
			message: 'record missing',
		});
		expect(result).toBe('[errors.notFound]{"message":"record missing"}');
	});

	it('maps "io" type to errors.io i18n key', () => {
		const result = mapErrorToI18n('io', 'disk full');

		expect(t).toHaveBeenCalledWith('errors.io', { message: 'disk full' });
		expect(result).toBe('[errors.io]{"message":"disk full"}');
	});

	it('maps "validation" type to errors.validation i18n key', () => {
		const result = mapErrorToI18n('validation', 'field required');

		expect(t).toHaveBeenCalledWith('errors.validation', {
			message: 'field required',
		});
		expect(result).toBe('[errors.validation]{"message":"field required"}');
	});

	it('maps "network" type to errors.network i18n key', () => {
		const result = mapErrorToI18n('network', 'timeout');

		expect(t).toHaveBeenCalledWith('errors.network', {
			message: 'timeout',
		});
		expect(result).toBe('[errors.network]{"message":"timeout"}');
	});

	it('is case-insensitive for error type matching', () => {
		const result = mapErrorToI18n('DATABASE', 'upper case type');

		expect(t).toHaveBeenCalledWith('errors.database', {
			message: 'upper case type',
		});
		expect(result).toBe('[errors.database]{"message":"upper case type"}');
	});

	it('handles mixed case error types', () => {
		const result = mapErrorToI18n('NotFound', 'mixed case');

		expect(t).toHaveBeenCalledWith('errors.notFound', {
			message: 'mixed case',
		});
		expect(result).toBe('[errors.notFound]{"message":"mixed case"}');
	});

	it('returns raw message for unknown error types', () => {
		const result = mapErrorToI18n('unknown', 'something broke');

		expect(result).toBe('something broke');
	});

	it('returns raw message for completely unrecognized error types', () => {
		const result = mapErrorToI18n('foobar', 'weird error');

		expect(result).toBe('weird error');
	});

	it('handles empty string error type by falling through to default', () => {
		const result = mapErrorToI18n('', 'fallback message');

		expect(result).toBe('fallback message');
	});
});
