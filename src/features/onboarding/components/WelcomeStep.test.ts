import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import WelcomeStep from './WelcomeStep.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string) => key),
}));

describe('WelcomeStep', () => {
	it('renders welcome content', () => {
		render(WelcomeStep, { onNext: vi.fn() });

		expect(screen.getByText('welcomeStep.title')).toBeTruthy();
		expect(screen.getByText('welcomeStep.getStarted')).toBeTruthy();
	});

	it('calls onNext when get started is clicked', async () => {
		const onNext = vi.fn();
		render(WelcomeStep, { onNext });

		const btn = screen.getByText('welcomeStep.getStarted');
		await fireEvent.click(btn);

		expect(onNext).toHaveBeenCalled();
	});
});
