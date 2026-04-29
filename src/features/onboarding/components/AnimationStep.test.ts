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
		render(AnimationStep, { onNext: vi.fn(), onBack: vi.fn() });

		expect(screen.getByText('animationStep.title')).toBeTruthy();
		expect(screen.getByText('animationStep.enableAnimations')).toBeTruthy();
	});

	it('toggles animations when switch is clicked', async () => {
		render(AnimationStep, { onNext: vi.fn(), onBack: vi.fn() });

		const toggle = screen.getByRole('switch');
		await fireEvent.click(toggle);

		expect(animationStore.animationsEnabled).toBe(false);
	});
	it('calls navigation callbacks', async () => {
		const onNext = vi.fn();
		const onBack = vi.fn();
		render(AnimationStep, { onNext, onBack });

		await fireEvent.click(screen.getByText('common.next'));
		expect(onNext).toHaveBeenCalled();

		await fireEvent.click(screen.getByText('common.back'));
		expect(onBack).toHaveBeenCalled();
	});
});
