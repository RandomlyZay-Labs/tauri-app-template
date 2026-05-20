import { mockIPC } from '@tauri-apps/api/mocks';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './HomePage.svelte';

// Mock STORES
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

vi.mock('@/lib/i18n', () => ({
	t: (key: string) => key,
}));

describe('HomePage', () => {
	beforeEach(() => {
		mockIPC((cmd) => {
			if (cmd === 'get_log_path') return '/mock/logs';
			if (cmd === 'list_jobs') return [];
			if (cmd === 'list_backups') return [];
			if (cmd === 'get_data_dir') return '/mock/data';
			if (cmd === 'plugin:dialog|open') return null;
		});
	});

	it('renders correctly with all feature cards', async () => {
		render(HomePage);

		await tick();
		await tick();

		// Check for title
		expect(screen.getByText('home.title')).toBeTruthy();

		// Verify child components (Feature Cards) are rendered by checking their translated titles
		expect(screen.getByText('debugSettings.secureStorage')).toBeTruthy();
		expect(screen.getByText('debugSettings.fileWatcher')).toBeTruthy();
	});
});
