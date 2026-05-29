import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { animationStore } from '@/stores/animationStore.svelte';
import AnimationStep from './AnimationStep.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string) => key),
}));

describe('AnimationStep', () => {
	beforeEach(() => {
		animationStore.setAnimationsEnabled(true);
	});

	it('renders animation toggle', () => {
		render(AnimationStep);

		expect(screen.getByText('animationStep.title')).toBeTruthy();
		expect(screen.getByText('animationStep.enableAnimations')).toBeTruthy();
	});

	it('toggles animations when switch is clicked', async () => {
		render(AnimationStep);

		const toggle = screen.getByRole('switch');
		await fireEvent.click(toggle);

		expect(animationStore.animationsEnabled).toBe(false);
	});
});
