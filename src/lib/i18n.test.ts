import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

/**
 * Recursively extracts all keys from a nested object,
 * returning them as dot-separated paths (e.g., "common.home").
 */
function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
	return Object.entries(obj).flatMap(([key, value]) => {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			return getKeys(value as Record<string, unknown>, fullKey);
		}
		return [fullKey];
	});
}

describe('i18n translation files', () => {
	const enKeys = getKeys(en);
	const esKeys = getKeys(es);

	it('en.json and es.json have the same number of keys', () => {
		expect(enKeys.length).toBe(esKeys.length);
	});

	it('every key in en.json exists in es.json', () => {
		const missingInEs = enKeys.filter((key) => !esKeys.includes(key));
		expect(missingInEs).toEqual([]);
	});

	it('every key in es.json exists in en.json', () => {
		const missingInEn = esKeys.filter((key) => !enKeys.includes(key));
		expect(missingInEn).toEqual([]);
	});

	it('no en.json values are empty strings', () => {
		const emptyKeys = enKeys.filter((key) => {
			const parts = key.split('.');
			let value: unknown = en;
			for (const part of parts) {
				value = (value as Record<string, unknown>)[part];
			}
			return value === '';
		});
		expect(emptyKeys).toEqual([]);
	});
});
