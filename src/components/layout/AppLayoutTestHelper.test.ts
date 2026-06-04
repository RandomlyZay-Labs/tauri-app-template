import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import AppLayoutTestHelper from './AppLayoutTestHelper.svelte';

vi.mock('@/stores/uiStore.svelte', () => ({
	uiStore: {
		get _hasHydrated() {
			return true;
		},
		get sidebarOpen() {
			return true;
		},
		toggleSidebar: vi.fn(),
	},
}));

vi.mock('@/stores/activityStore.svelte', () => ({
	activityStore: {
		activities: {},
		get sortedActivities() {
			return [];
		},
		get isOpen() {
			return false;
		},
		setIsOpen: vi.fn(),
	},
}));

vi.mock('@/lib/i18n', () => ({
	t: (key: string) => key,
}));

describe('AppLayoutTestHelper', () => {
	it('renders children within AppLayout', async () => {
		render(AppLayoutTestHelper);
		await tick();
		expect(screen.getByTestId('test-children')).toBeTruthy();
		expect(screen.getByText(/Test Children/i)).toBeTruthy();
	});
});
