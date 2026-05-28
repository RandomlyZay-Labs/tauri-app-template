import { mockIPC } from '@tauri-apps/api/mocks';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from './SettingsPage.svelte';

vi.mock('@/stores/uiStore.svelte', () => ({
	uiStore: {
		get _hasHydrated() {
			return true;
		},
		get sidebarOpen() {
			return true;
		},
		setActiveSettingsTab: vi.fn(),
	},
	validateSettingsTab: (tab: unknown) => {
		const allowed = ['general', 'appearance', 'backups', 'debug', 'updates'];
		return typeof tab === 'string' && allowed.includes(tab) ? tab : 'general';
	},
}));

vi.mock('@/stores/backupStore.svelte', () => ({
	backupStore: {
		get enabled() {
			return false;
		},
		get interval() {
			return 3600;
		},
		get maxBackups() {
			return 5;
		},
		setEnabled: vi.fn(),
		setInterval: vi.fn(),
		setMaxBackups: vi.fn(),
	},
	BACKUP_INTERVALS: {
		HOURLY: 3600,
		DAILY: 86400,
		WEEKLY: 604800,
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

describe('SettingsPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIPC((cmd) => {
			if (cmd === 'list_backups') return [];
			if (cmd === 'get_log_path') return '/mock/logs';
			if (cmd === 'get_data_dir') return '/mock/data';
			if (cmd === 'get_cli_status') return { installed: false, version: null };
		});
	});

	it('renders correctly', async () => {
		render(SettingsPage);
		await tick();
		expect(screen.getByText('settings.title')).toBeDefined();
	});

	it('switches tabs correctly', async () => {
		render(SettingsPage);
		await tick();
		const appearanceTab = screen.getByTestId('tab-trigger-appearance');
		await fireEvent.click(appearanceTab);
		expect(screen.getByText('settings.appearance')).toBeDefined();
	});
});
