// SPDX-License-Identifier: MIT
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import WelcomeStep from './WelcomeStep.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string) => key),
}));

describe('WelcomeStep', () => {
	it('renders welcome content', () => {
		render(WelcomeStep);

		expect(screen.getByText('welcomeStep.title')).toBeTruthy();
		expect(screen.getByText('welcomeStep.description')).toBeTruthy();
	});
});
