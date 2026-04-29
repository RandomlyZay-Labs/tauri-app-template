import { mockIPC } from '@tauri-apps/api/mocks';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Activity, activityStore } from '@/stores/activityStore.svelte';
import { networkStore } from '@/stores/networkStore.svelte';
import DownloadCard from './DownloadCard.svelte';

vi.mock('@/stores/activityStore.svelte', () => ({
	activityStore: {
		activities: {},
	},
}));

vi.mock('@/stores/networkStore.svelte', () => ({
	networkStore: {
		isOffline: false,
	},
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

vi.mock('@/lib/logger', () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
	},
}));

describe('DownloadCard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		networkStore.isOffline = false;
		activityStore.activities = {};

		mockIPC((cmd) => {
			if (cmd === 'plugin:dialog|open') return Promise.resolve('/downloads');
			if (cmd === 'submit_download_job')
				return Promise.resolve({ id: 'job-1' });
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('renders correctly', () => {
		render(DownloadCard);
		expect(screen.getByText('downloadCard.title')).toBeDefined();
		expect(screen.getByLabelText('downloadCard.url')).toBeDefined();
		expect(screen.getByLabelText('downloadCard.destination')).toBeDefined();
	});

	it('browses for a directory', async () => {
		let capturedArgs: unknown = null;
		mockIPC((cmd, args) => {
			if (cmd === 'plugin:dialog|open') {
				capturedArgs = args;
				return Promise.resolve('/path/to/dir');
			}
		});

		render(DownloadCard);

		const browseBtn = screen.getByText('downloadCard.chooseDir');
		await fireEvent.click(browseBtn);

		expect(capturedArgs).toEqual({
			options: { directory: true, multiple: false },
		});
		const destInput = screen.getByPlaceholderText(
			'downloadCard.chooseDirPlaceholder',
		) as HTMLInputElement;
		await waitFor(() => expect(destInput.value).toBe('/path/to/dir'));
	});

	it('disables submit button when inputs are empty', () => {
		render(DownloadCard);
		const submitBtn = screen.getByRole('button', {
			name: /downloadCard.download/i,
		}) as HTMLButtonElement;
		expect(submitBtn.disabled).toBe(true);
	});

	it('submits a download job and updates activity store', {
		timeout: 20000,
	}, async () => {
		const { toast } = await import('@/lib/toast');
		const jobId = 'job-1';

		let capturedArgs: unknown = null;
		mockIPC((cmd, args) => {
			if (cmd === 'plugin:dialog|open') return Promise.resolve('/downloads');
			if (cmd === 'submit_download_job') {
				capturedArgs = args;
				return Promise.resolve({ id: jobId });
			}
		});

		render(DownloadCard);

		const urlInput = screen.getByPlaceholderText('downloadCard.urlPlaceholder');
		await fireEvent.input(urlInput, {
			target: { value: 'https://example.com/file.zip' },
		});

		const browseBtn = screen.getByText('downloadCard.chooseDir');
		await fireEvent.click(browseBtn);

		const submitBtn = screen.getByRole('button', {
			name: /downloadCard.download/i,
		}) as HTMLButtonElement;

		await tick();

		await waitFor(() => expect(submitBtn.disabled).toBe(false));

		await fireEvent.click(submitBtn);

		// Assert command called
		expect(capturedArgs).toEqual({
			request: {
				url: 'https://example.com/file.zip',
				destDir: '/downloads',
				filename: null,
			},
		});

		// Simulate the activity store update (which normally happens via events in LifecycleManager)
		activityStore.activities[jobId] = {
			id: jobId,
			kind: 'download',
			label: 'Mock download',
			status: 'pending',
			progress: 0,
			speedBps: 0,
			etaSecs: 0,
			message: null,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		} as Activity;

		await tick();

		await waitFor(() => {
			expect(toast.success).toHaveBeenCalledWith(
				'downloadCard.downloadSubmitted',
			);
		});

		expect((urlInput as HTMLInputElement).value).toBe('');
	});

	it('disables button when offline', async () => {
		networkStore.isOffline = true;
		render(DownloadCard);

		const urlInput = screen.getByPlaceholderText('downloadCard.urlPlaceholder');
		await fireEvent.input(urlInput, {
			target: { value: 'https://example.com' },
		});

		const submitBtn = screen.getByRole('button', {
			name: /downloadCard.download/i,
		}) as HTMLButtonElement;
		expect(submitBtn.disabled).toBe(true);
	});
});
