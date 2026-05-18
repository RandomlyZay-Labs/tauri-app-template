import fs from 'node:fs';
import path from 'node:path';
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

	it('every static t(...) translation key used in the codebase exists in en.json', () => {
		function getFiles(dir: string): string[] {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			const files = entries.flatMap((entry) => {
				const res = path.resolve(dir, entry.name);
				if (entry.isDirectory()) {
					if (
						entry.name === 'node_modules' ||
						entry.name === 'test' ||
						entry.name === '.svelte-kit'
					) {
						return [];
					}
					return getFiles(res);
				} else {
					if (
						(entry.name.endsWith('.svelte') || entry.name.endsWith('.ts')) &&
						!entry.name.endsWith('.test.ts') &&
						!entry.name.endsWith('.spec.ts') &&
						entry.name !== 'bindings.ts'
					) {
						return [res];
					}
					return [];
				}
			});
			return files;
		}

		const files = getFiles(path.resolve(process.cwd(), 'src'));
		const usedKeys = new Set<string>();
		const tRegex = /\bt\(\s*['"`]([a-zA-Z0-9_.-]+)['"`]\s*(?:,|\))/g;

		for (const file of files) {
			const rawContent = fs.readFileSync(file, 'utf-8');
			const content = rawContent
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/\/\/.*$/gm, '');
			const matches = content.matchAll(tRegex);
			for (const match of matches) {
				usedKeys.add(match[1]);
			}
		}

		const missingKeys = Array.from(usedKeys).filter((key) => {
			if (enKeys.includes(key)) {
				return false;
			}
			// Check for i18next plural suffix conventions
			if (enKeys.includes(`${key}_one`) || enKeys.includes(`${key}_other`)) {
				return false;
			}
			return true;
		});

		expect(missingKeys).toEqual([]);
	});

	it('every translation key in en.json is referenced somewhere in the codebase', () => {
		function getFiles(dir: string): string[] {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			const files = entries.flatMap((entry) => {
				const res = path.resolve(dir, entry.name);
				if (entry.isDirectory()) {
					if (
						entry.name === 'node_modules' ||
						entry.name === 'test' ||
						entry.name === '.svelte-kit'
					) {
						return [];
					}
					return getFiles(res);
				} else {
					if (
						(entry.name.endsWith('.svelte') || entry.name.endsWith('.ts')) &&
						!entry.name.endsWith('.test.ts') &&
						!entry.name.endsWith('.spec.ts') &&
						entry.name !== 'bindings.ts'
					) {
						return [res];
					}
					return [];
				}
			});
			return files;
		}

		const files = getFiles(path.resolve(process.cwd(), 'src'));
		const fileContents = files.map((file) => {
			const rawContent = fs.readFileSync(file, 'utf-8');
			return rawContent
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/\/\/.*$/gm, '');
		});

		const unusedKeys = enKeys.filter((key) => {
			// Strip standard i18next plural/context suffixes
			let searchKey = key;
			if (key.endsWith('_one')) {
				searchKey = key.slice(0, -4);
			} else if (key.endsWith('_other')) {
				searchKey = key.slice(0, -6);
			}

			// Check if searchKey is present as a substring in any file
			const isUsed = fileContents.some((content) =>
				content.includes(searchKey),
			);
			return !isUsed;
		});

		expect(unusedKeys).toEqual([]);
	});
});
