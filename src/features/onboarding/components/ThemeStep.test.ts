import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { themeStore } from '@/stores/themeStore.svelte';
import ThemeStep from './ThemeStep.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string) => key),
}));

describe('ThemeStep', () => {
	beforeEach(() => {
		themeStore.setTheme('system');
	});

	it('renders theme options', () => {
		render(ThemeStep);

		expect(screen.getByText('themeStep.title')).toBeTruthy();
		expect(screen.getByText('common.light')).toBeTruthy();
		expect(screen.getByText('common.dark')).toBeTruthy();
		expect(screen.getByText('common.system')).toBeTruthy();
	});

	it('changes theme when an option is clicked', async () => {
		render(ThemeStep);

		const darkBtn = screen.getByText('common.dark');
		await fireEvent.click(darkBtn);

		expect(themeStore.theme).toBe('dark');
	});
});
