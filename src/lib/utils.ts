// SPDX-License-Identifier: MIT
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export type WithElementRef<T> = T & {
	ref?: HTMLElement | null;
};

export type WithoutChild<T> = Omit<T, 'child'>;
export type WithoutChildren<T> = Omit<T, 'children'>;
export type WithoutChildrenOrChild<T> = Omit<T, 'child' | 'children'>;

/**
 * Returns true if the user has NOT requested reduced motion (i.e. animations are enabled)
 * based on the system media query.
 */
export function getSystemAnimationPreference(): boolean {
	if (typeof window !== 'undefined' && window.matchMedia) {
		return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}
	return true;
}

/**
 * Formats bytes into a human-readable string (B, KB, MB, GB).
 */
export function formatSize(bytes: bigint | number) {
	const units = ['B', 'KB', 'MB', 'GB'];
	let size = Number(bytes);
	let i = 0;
	while (size >= 1024 && i < units.length - 1) {
		size /= 1024;
		i++;
	}
	return `${size.toFixed(1)} ${units[i]}`;
}

/**
 * Formats seconds into a human-readable duration string (e.g., "5m 20s").
 */
export function formatDuration(seconds: number) {
	if (seconds < 60) return `${Math.floor(seconds)}s`;
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	if (m < 60) return `${m}m ${s}s`;
	const h = Math.floor(m / 60);
	const mm = m % 60;
	return `${h}h ${mm}m`;
}

/**
 * Formats speed in bytes per second.
 */
export function formatSpeed(bps: number) {
	return `${formatSize(bps)}/s`;
}
