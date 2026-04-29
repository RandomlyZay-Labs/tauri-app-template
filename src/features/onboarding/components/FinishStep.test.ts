import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import FinishStep from './FinishStep.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string) => key),
}));

describe('FinishStep', () => {
	it('renders finish content', () => {
		render(FinishStep, { onNext: vi.fn(), onBack: vi.fn() });

		expect(screen.getByText('finishStep.title')).toBeTruthy();
		expect(screen.getByText('common.done')).toBeTruthy();
	});

	it('calls navigation callbacks', async () => {
		const onNext = vi.fn();
		const onBack = vi.fn();
		render(FinishStep, { onNext, onBack });

		await fireEvent.click(screen.getByText('common.done'));
		expect(onNext).toHaveBeenCalled();

		await fireEvent.click(screen.getByText('finishStep.backToPreferences'));
		expect(onBack).toHaveBeenCalled();
	});
});
