import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingPage from './OnboardingPage.svelte';

// Mock uiStore
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

// Mock svelte-spa-router push
vi.mock('svelte-spa-router', () => ({
	push: vi.fn(),
}));

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: (key: string) => key,
}));

// Mock animationStore
vi.mock('@/stores/animationStore.svelte', () => ({
	animationStore: {
		animationsEnabled: false,
	},
}));

// Mock embla-carousel-svelte to allow testing within Happy DOM
vi.mock('embla-carousel-svelte', () => {
	return {
		default: (node: HTMLElement) => {
			const mockApi = {
				scrollNext: vi.fn(),
				scrollPrev: vi.fn(),
				scrollTo: vi.fn(),
				selectedScrollSnap: () => 0,
				canScrollNext: () => true,
				canScrollPrev: () => false,
				scrollSnapList: () => [0, 1, 2, 3, 4, 5],
				on: vi.fn(),
				off: vi.fn(),
			};

			// Safely dispatch the emblaInit custom event
			setTimeout(() => {
				node.dispatchEvent(
					new CustomEvent('emblaInit', {
						detail: mockApi,
						bubbles: true,
					}),
				);
			}, 0);

			return {
				destroy: () => {},
			};
		},
	};
});

describe('OnboardingPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders onboarding page container', async () => {
		render(OnboardingPage);
		await tick();
		expect(screen.getByText('welcomeStep.title')).toBeDefined();
		expect(screen.getByText('welcomeStep.getStarted')).toBeDefined();
	});
});
