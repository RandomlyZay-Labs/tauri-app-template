import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openExternalLink } from '@/lib/system-utils';
import { toast } from '@/lib/toast';
import AboutPage from './AboutPage.svelte';

vi.mock('@/lib/app-version.svelte', () => ({
	getAppVersion: vi.fn(() => '1.0.0'),
}));

vi.mock('@/lib/system-utils', () => ({
	openExternalLink: vi.fn(),
}));

vi.mock('@/lib/toast', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock('@/lib/i18n', () => ({
	t: (key: string) => key,
}));

vi.mock('@/stores/animationStore.svelte', () => ({
	animationStore: {
		animationsEnabled: false,
	},
}));

vi.mock('@/stores/uiStore.svelte', () => ({
	uiStore: {
		get _hasHydrated() {
			return true;
		},
		get sidebarOpen() {
			return true;
		},
	},
}));

import { mockIPC } from '@tauri-apps/api/mocks';

describe('AboutPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIPC(() => {});
	});

	it('renders correctly', async () => {
		render(AboutPage);
		await tick();
		expect(screen.getByText('about.title')).toBeDefined();
		expect(screen.getByText('v1.0.0')).toBeDefined();
	});

	it('opens Ko-fi link when clicked', async () => {
		render(AboutPage);
		await tick();
		const kofiBtn = screen.getByTestId('kofi-btn');
		await fireEvent.click(kofiBtn);
		expect(openExternalLink).toHaveBeenCalledWith(
			'https://ko-fi.com/randomlyzay',
		);
	});

	it('handles failure when opening external link', async () => {
		vi.mocked(openExternalLink).mockRejectedValueOnce(
			new Error('Failed to open link'),
		);
		render(AboutPage);
		await tick();
		const kofiBtn = screen.getByTestId('kofi-btn');
		await fireEvent.click(kofiBtn);

		// Now using real executeSafeAction (no mock), so we expect toast.error to be called
		expect(openExternalLink).toHaveBeenCalled();
		await tick();
		expect(toast.error).toHaveBeenCalled();
	});
});
