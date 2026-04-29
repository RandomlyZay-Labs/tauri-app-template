// SPDX-License-Identifier: MIT
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { push } from 'svelte-spa-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { themeStore } from '@/stores/themeStore.svelte';
import { uiStore } from '@/stores/uiStore.svelte';
import CommandPalette from './CommandPalette.svelte';

// Mock svelte-spa-router
vi.mock('svelte-spa-router', () => ({
	push: vi.fn(),
}));

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string) => key),
}));

describe('CommandPalette', () => {
	beforeEach(() => {
		// Aggressive workaround for bits-ui Svelte 5 teardown bug in happy-dom
		// The `node` variable becomes something without querySelector.
		// @ts-expect-error
		if (!Object.prototype.querySelector) {
			Object.defineProperty(Object.prototype, 'querySelector', {
				value: () => null,
				configurable: true,
				writable: true,
			});
		}
	});

	afterEach(async () => {
		uiStore.setCommandPaletteOpen(false);
		await tick();
		// Wait for bits-ui to clear body scroll lock timeout (minimum 24ms delay)
		await new Promise((r) => setTimeout(r, 50));

		// @ts-expect-error
		if (Object.prototype.querySelector) {
			// @ts-expect-error
			delete Object.prototype.querySelector;
		}
	});

	it('opens when Ctrl+K is pressed', async () => {
		render(CommandPalette);

		expect(uiStore.commandPaletteOpen).toBe(false);

		await fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

		expect(uiStore.commandPaletteOpen).toBe(true);
	});

	it('opens when Meta+K is pressed', async () => {
		uiStore.setCommandPaletteOpen(false);
		render(CommandPalette);

		await fireEvent.keyDown(window, { key: 'k', metaKey: true });

		expect(uiStore.commandPaletteOpen).toBe(true);
	});

	it('closes when a command is executed', async () => {
		uiStore.setCommandPaletteOpen(true);
		render(CommandPalette);

		// Find the "Home" command and click it
		const homeItem = screen.getByText('common.home');
		await fireEvent.click(homeItem);

		expect(push).toHaveBeenCalledWith('/');
		expect(uiStore.commandPaletteOpen).toBe(false);
	});

	it('changes theme when theme command is selected', async () => {
		uiStore.setCommandPaletteOpen(true);
		render(CommandPalette);

		const setThemeSpy = vi.spyOn(themeStore, 'setTheme');

		const darkThemeItem = screen.getByText('common.dark');
		await fireEvent.click(darkThemeItem);

		expect(setThemeSpy).toHaveBeenCalledWith('dark');
		expect(uiStore.commandPaletteOpen).toBe(false);
	});

	it('reloads window when reload command is selected', async () => {
		uiStore.setCommandPaletteOpen(true);
		render(CommandPalette);

		// Mock window.location.reload
		const originalReload = window.location.reload;
		// @ts-expect-error
		delete window.location;
		window.location = { ...window.location, reload: vi.fn() };

		const reloadItem = screen.getByText('commandPalette.reloadWindow');
		await fireEvent.click(reloadItem);

		expect(window.location.reload).toHaveBeenCalled();
		expect(uiStore.commandPaletteOpen).toBe(false);

		// Restore
		window.location = originalReload;
	});
});
