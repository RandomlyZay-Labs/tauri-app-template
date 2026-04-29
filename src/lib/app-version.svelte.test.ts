import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '@/lib/ipc';

vi.mock('@/lib/ipc', () => ({
	commands: {
		getVersion: vi.fn(),
	},
}));

describe('app-version.svelte', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it('initially returns 0.0.0 and eventually updates', async () => {
		// We need to re-import getAppVersion to reset state
		const { getAppVersion } = await import('./app-version.svelte');

		let resolveVersion: (v: string) => void = () => {};
		const versionPromise = new Promise<string>((resolve) => {
			resolveVersion = resolve;
		});
		vi.mocked(commands.getVersion).mockReturnValue(versionPromise);

		// First call
		const v1 = getAppVersion();
		expect(v1).toBe('0.0.0');
		expect(commands.getVersion).toHaveBeenCalledTimes(1);

		// Concurrent call
		const v2 = getAppVersion();
		expect(v2).toBe('0.0.0');
		expect(commands.getVersion).toHaveBeenCalledTimes(1);

		// Resolve promise
		resolveVersion('1.2.3');
		await versionPromise;

		// Should eventually update (Svelte state is async, so we might need a tick or just check again later if it was a store)
		// But here it's a simple variable with $state.
		// Since we're in Vitest, we'll just check if it's correct now.
		const v3 = getAppVersion();
		expect(v3).toBe('1.2.3');
	});

	it('handles error gracefully if getVersion fails', async () => {
		const { getAppVersion } = await import('./app-version.svelte');

		vi.mocked(commands.getVersion).mockRejectedValueOnce(
			new Error('IPC Error'),
		);
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const v = getAppVersion();
		expect(v).toBe('0.0.0');

		// Wait for promise rejection
		await new Promise(process.nextTick);

		expect(consoleSpy).toHaveBeenCalledWith(
			'Failed to get app version:',
			expect.any(Error),
		);
		expect(getAppVersion()).toBe('0.0.0');
		consoleSpy.mockRestore();
	});
});
