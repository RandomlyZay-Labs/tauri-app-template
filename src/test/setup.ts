import { cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, vi } from 'vitest';

// ResizeObserver polyfill
globalThis.ResizeObserver = class ResizeObserver {
	private callback: ResizeObserverCallback;
	constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
	}
	observe() {}
	unobserve() {}
	disconnect() {}
	trigger(entries: ResizeObserverEntry[]) {
		this.callback(entries, this);
	}
};
// ScrollIntoView polyfill
window.HTMLElement.prototype.scrollIntoView = () => {};
// Animate polyfill
window.HTMLElement.prototype.animate = vi.fn().mockReturnValue({
	finished: Promise.resolve(),
	cancel: vi.fn(),
	pause: vi.fn(),
	play: vi.fn(),
	reverse: vi.fn(),
	finish: vi.fn(),
	onfinish: null,
	oncancel: null,
	playState: 'finished',
});

import { mockIPC } from '@tauri-apps/api/mocks';

// Global mock for Tauri IPC to ensure internals are initialized and basic plugins are handled
mockIPC((cmd) => {
	if (cmd === 'plugin:log|log') {
		return Promise.resolve();
	}
	if (cmd.startsWith('plugin:updater|')) {
		return Promise.resolve(null);
	}
	if (cmd === 'plugin:process|restart' || cmd === 'plugin:process|relaunch') {
		return Promise.resolve();
	}
	if (cmd === 'plugin:process|exit') {
		return Promise.resolve();
	}
});

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
	writeText: vi.fn(),
}));

afterEach(async () => {
	// Flush any pending microtasks (Svelte updates)
	await tick();

	cleanup();

	// If the test enabled fake timers, flush them after cleanup
	// to execute any timeouts scheduled by component unmounting (like bits-ui focus traps).
	try {
		if (vi.isFakeTimers()) {
			vi.runAllTimers();
			vi.useRealTimers();
		}
	} catch (_e) {
		// Ignore
	}

	// Small tick to ensure cleanup microtasks are processed (now using real timers)
	await new Promise((r) => setTimeout(r, 0));
});
