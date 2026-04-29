import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar.svelte';

vi.mock('@/stores/uiStore.svelte', () => ({
	uiStore: {
		get sidebarOpen() {
			return true;
		},
		toggleSidebar: vi.fn(),
	},
}));

vi.mock('@/stores/activityStore.svelte', () => ({
	activityStore: {
		activities: {},
		setIsOpen: vi.fn(),
	},
}));

vi.mock('@/stores/notificationStore.svelte', () => ({
	notificationStore: {
		setIsOpen: vi.fn(),
	},
}));

vi.mock('@/lib/i18n', () => ({
	t: (key: string) => key,
}));

import { mockIPC } from '@tauri-apps/api/mocks';

describe('Sidebar', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIPC(() => {});
	});

	it('renders navigation links', async () => {
		render(Sidebar);
		await tick();
		expect(screen.getByTestId('nav-home')).toBeDefined();
	});

	it('toggles sidebar when button is clicked', async () => {
		render(Sidebar);
		await tick();
		const toggleBtn = screen.getByRole('button', {
			name: /sidebar\.(collapse|expand)Sidebar/i,
		});
		await fireEvent.click(toggleBtn);

		const { uiStore } = await import('@/stores/uiStore.svelte');
		expect(uiStore.toggleSidebar).toHaveBeenCalled();
	});
});
