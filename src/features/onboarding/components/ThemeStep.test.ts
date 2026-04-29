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
		render(ThemeStep, { onNext: vi.fn(), onBack: vi.fn() });

		expect(screen.getByText('themeStep.title')).toBeTruthy();
		expect(screen.getByText('common.light')).toBeTruthy();
		expect(screen.getByText('common.dark')).toBeTruthy();
		expect(screen.getByText('common.system')).toBeTruthy();
	});

	it('changes theme when an option is clicked', async () => {
		render(ThemeStep, { onNext: vi.fn(), onBack: vi.fn() });

		const darkBtn = screen.getByText('common.dark');
		await fireEvent.click(darkBtn);

		expect(themeStore.theme).toBe('dark');
	});

	it('calls navigation callbacks', async () => {
		const onNext = vi.fn();
		const onBack = vi.fn();
		render(ThemeStep, { onNext, onBack });

		await fireEvent.click(screen.getByText('common.next'));
		expect(onNext).toHaveBeenCalled();

		await fireEvent.click(screen.getByText('common.back'));
		expect(onBack).toHaveBeenCalled();
	});
});
