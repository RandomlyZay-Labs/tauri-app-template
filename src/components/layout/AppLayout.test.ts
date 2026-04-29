// SPDX-License-Identifier: MIT
import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppLayoutTestHelper from './AppLayoutTestHelper.svelte';

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

import { mockIPC } from '@tauri-apps/api/mocks';

describe('AppLayout', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIPC(() => {});
	});

	it('renders content when hydrated', async () => {
		render(AppLayoutTestHelper);

		await tick();
		await tick();

		await waitFor(
			() => {
				expect(screen.getByTestId('test-children')).toBeDefined();
			},
			{ timeout: 2000 },
		);
	});
});
