import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lifecycleManager } from '@/lib/lifecycle.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import App from './App.svelte';

vi.mock('@/stores/uiStore.svelte', () => {
	let _hasHydrated = true;
	return {
		uiStore: {
			get _hasHydrated() {
				return _hasHydrated;
			},
			set _hasHydrated(v) {
				_hasHydrated = v;
			},
			get onboardingCompleted() {
				return true;
			},
		},
	};
});

vi.mock('@/stores/activityStore.svelte', () => ({
	activityStore: {
		get sortedActivities() {
			return [];
		},
		get isOpen() {
			return false;
		},
	},
}));

vi.mock('@/stores/notificationStore.svelte', () => ({
	notificationStore: {
		get isOpen() {
			return false;
		},
	},
}));

vi.mock('@/lib/lifecycle.svelte', () => ({
	lifecycleManager: {
		init: vi.fn(),
		destroy: vi.fn(),
	},
}));

vi.mock('@/lib/i18n', () => ({
	t: (key: string) => key,
}));

import { mockIPC } from '@tauri-apps/api/mocks';

// Mock Router
vi.mock('svelte-spa-router', () => ({
	default: vi.fn().mockImplementation(() => {
		const div = document.createElement('div');
		div.id = 'router-mock';
		return {
			// Svelte 5 component structure is different, but for vitest-mocking it's okay
			$$render: () => '<div>Mock Router</div>',
		};
	}),
	push: vi.fn(),
	router: {
		location: '/',
	},
}));

// Mock sonner
vi.mock('svelte-sonner', () => ({
	Toaster: vi.fn(),
	toast: {
		dismiss: vi.fn(),
		promise: vi.fn(),
		custom: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
	},
}));

describe('App', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIPC(() => {});
	});

	it('renders correctly', async () => {
		const { container } = render(App);
		await tick();
		expect(container).toBeDefined();
	});

	it('renders even if not yet hydrated', async () => {
		uiStore._hasHydrated = false;
		const { container } = render(App);
		await tick();
		expect(container).toBeDefined();
	});

	it('initializes lifecycleManager on mount', async () => {
		render(App);
		await tick();
		expect(lifecycleManager.init).toHaveBeenCalledOnce();
	});

	it('destroys lifecycleManager on unmount', async () => {
		const { unmount } = render(App);
		await tick();
		unmount();
		expect(lifecycleManager.destroy).toHaveBeenCalledOnce();
	});
});
