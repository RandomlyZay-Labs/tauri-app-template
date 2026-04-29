import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingPage from './OnboardingPage.svelte';

vi.mock('@/stores/uiStore.svelte', () => ({
	uiStore: {
		get _hasHydrated() {
			return true;
		},
		get onboardingCompleted() {
			return false;
		},
		setOnboardingCompleted: vi.fn(),
	},
}));

vi.mock('svelte-spa-router', () => ({
	push: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
	t: (key: string) => key,
}));

vi.mock('@/stores/animationStore.svelte', () => ({
	animationStore: {
		animationsEnabled: false,
	},
}));

import { mockIPC } from '@tauri-apps/api/mocks';

describe('OnboardingPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIPC(() => {});
	});

	it('renders correctly', async () => {
		render(OnboardingPage);
		await tick();
		// WelcomeStep text
		expect(screen.getByText('welcomeStep.title')).toBeDefined();
	});
});
