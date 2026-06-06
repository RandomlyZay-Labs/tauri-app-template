import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import FinishStep from './FinishStep.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string) => key),
}));

describe('FinishStep', () => {
	it('renders finish content', () => {
		render(FinishStep);

		expect(screen.getByText('finishStep.title')).toBeTruthy();
		expect(screen.getByText('finishStep.description')).toBeTruthy();
	});
});
