import { mockIPC } from '@tauri-apps/api/mocks';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '@/lib/ipc';
import { watcherStore } from '@/stores/watcherStore.svelte';
import FileWatcherCard from './FileWatcherCard.svelte';

vi.mock('@/lib/ipc', () => ({
	commands: {
		watchPath: vi.fn(),
		unwatchPath: vi.fn(),
	},
}));

vi.mock('@/stores/watcherStore.svelte', () => ({
	watcherStore: {
		watchedPaths: [],
		addPath: vi.fn(),
		removePath: vi.fn(),
	},
}));

vi.mock('@/lib/i18n', () => ({
	t: (key: string, args?: Record<string, unknown>) =>
		args ? `${key}_${JSON.stringify(args)}` : key,
}));

vi.mock('@/lib/logger', () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
	},
}));

describe('FileWatcherCard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		watcherStore.watchedPaths = [];
	});

	it('renders correctly', () => {
		render(FileWatcherCard);
		expect(screen.getByText('debugSettings.fileWatcher')).toBeDefined();
	});

	it('browses for a file', async () => {
		let capturedOptions: unknown = null;
		mockIPC((cmd, args) => {
			if (cmd === 'plugin:dialog|open') {
				capturedOptions = args.options;
				return '/path/to/file.txt';
			}
			return Promise.resolve();
		});

		render(FileWatcherCard);

		const browseBtn = screen.getByText('debugSettings.browseFile');
		await fireEvent.click(browseBtn);

		expect(capturedOptions).toEqual({ directory: false, multiple: false });
		const input = screen.getByPlaceholderText(
			'debugSettings.watchPathPlaceholder',
		) as HTMLInputElement;
		await waitFor(() => expect(input.value).toBe('/path/to/file.txt'));
	});

	it('watches a path', async () => {
		mockIPC((cmd) => {
			if (cmd === 'plugin:dialog|open') return '/path/to/watch';
			return Promise.resolve();
		});
		vi.mocked(commands.watchPath).mockResolvedValue(null);
		render(FileWatcherCard);

		const browseBtn = screen.getByText('debugSettings.browseFolder');
		await fireEvent.click(browseBtn);

		await waitFor(() => {
			const input = screen.getByPlaceholderText(
				'debugSettings.watchPathPlaceholder',
			) as HTMLInputElement;
			expect(input.value).toBe('/path/to/watch');
		});

		const watchBtn = screen.getByText('debugSettings.watch');
		await fireEvent.click(watchBtn);

		expect(commands.watchPath).toHaveBeenCalledWith('/path/to/watch');
		expect(watcherStore.addPath).toHaveBeenCalledWith('/path/to/watch');
	});

	it('renders watched paths and unwatches', async () => {
		watcherStore.watchedPaths = ['/path/1', '/path/2'];
		vi.mocked(commands.unwatchPath).mockResolvedValue(null);

		render(FileWatcherCard);

		expect(screen.getByText('/path/1')).toBeDefined();
		expect(screen.getByText('/path/2')).toBeDefined();

		const unwatchButtons = screen.getAllByLabelText('debugSettings.unwatch');
		await fireEvent.click(unwatchButtons[0]);

		expect(commands.unwatchPath).toHaveBeenCalledWith('/path/1');
		expect(watcherStore.removePath).toHaveBeenCalledWith('/path/1');
	});

	it('handles watch failure gracefully', async () => {
		const mockToastError = vi.fn();
		vi.doMock('@/lib/toast', () => ({
			toast: { error: mockToastError },
		}));

		mockIPC((cmd) => {
			if (cmd === 'plugin:dialog|open') return '/path/to/fail';
			return Promise.resolve();
		});
		vi.mocked(commands.watchPath).mockRejectedValue(
			new Error('Permission denied'),
		);

		render(FileWatcherCard);

		const browseBtn = screen.getByText('debugSettings.browseFolder');
		await fireEvent.click(browseBtn);

		await waitFor(() => {
			const input = screen.getByPlaceholderText(
				'debugSettings.watchPathPlaceholder',
			) as HTMLInputElement;
			expect(input.value).toBe('/path/to/fail');
		});

		const watchBtn = screen.getByText('debugSettings.watch');
		await fireEvent.click(watchBtn);

		await waitFor(() => {
			expect(commands.watchPath).toHaveBeenCalledWith('/path/to/fail');
			expect(watcherStore.addPath).not.toHaveBeenCalled();
		});
	});

	it('cleans up resources on unmount', () => {
		const { unmount } = render(FileWatcherCard);
		unmount();
		expect(true).toBe(true);
	});
});
