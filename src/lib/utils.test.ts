// SPDX-License-Identifier: MIT
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cn, formatSize, getSystemAnimationPreference } from '@/lib/utils';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('cn', () => {
	it('should merge class names correctly', () => {
		expect(cn('foo', 'bar')).toBe('foo bar');
	});

	it('should handle conditional classes', () => {
		expect(cn('foo', true && 'bar', false && 'baz')).toBe('foo bar');
	});

	it('should handle arrays and objects', () => {
		expect(cn(['foo', 'bar'], { baz: true, qux: false })).toBe('foo bar baz');
	});

	it('should resolve tailwind conflicts', () => {
		expect(cn('p-4', 'p-2')).toBe('p-2');
		expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
	});

	it('should handle complex combinations', () => {
		expect(
			cn('flex', ['items-center', { 'justify-center': true }], 'p-4', 'p-2'),
		).toBe('flex items-center justify-center p-2');
	});
});

describe('getSystemAnimationPreference', () => {
	it('should return false when prefers-reduced-motion: reduce matches', () => {
		const matchMedia = vi.fn().mockImplementation((query) => ({
			matches: query === '(prefers-reduced-motion: reduce)',
			media: query,
			onchange: null,
			addListener: vi.fn(), // Deprecated
			removeListener: vi.fn(), // Deprecated
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
		vi.stubGlobal('matchMedia', matchMedia);
		expect(getSystemAnimationPreference()).toBe(false);
	});

	it('should return true when prefers-reduced-motion: reduce does not match', () => {
		const matchMedia = vi.fn().mockImplementation((query) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(), // Deprecated
			removeListener: vi.fn(), // Deprecated
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
		vi.stubGlobal('matchMedia', matchMedia);
		expect(getSystemAnimationPreference()).toBe(true);
	});

	it('should return true when matchMedia is undefined', () => {
		vi.stubGlobal('matchMedia', undefined);
		expect(getSystemAnimationPreference()).toBe(true);
	});
});

describe('formatSize', () => {
	it('should format bytes', () => {
		expect(formatSize(500)).toBe('500.0 B');
		expect(formatSize(0)).toBe('0.0 B');
	});

	it('should format KB', () => {
		expect(formatSize(1024)).toBe('1.0 KB');
		expect(formatSize(1536)).toBe('1.5 KB');
	});

	it('should format MB', () => {
		expect(formatSize(1024 * 1024)).toBe('1.0 MB');
	});

	it('should format GB', () => {
		expect(formatSize(1024 * 1024 * 1024)).toBe('1.0 GB');
	});

	it('should handle BigInt', () => {
		expect(formatSize(BigInt(1024))).toBe('1.0 KB');
	});
});
