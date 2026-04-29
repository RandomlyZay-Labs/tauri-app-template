// SPDX-License-Identifier: MIT
import { mockIPC } from '@tauri-apps/api/mocks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	exitApp,
	getCliStatus,
	installCli,
	openDataDirectory,
	openExternalLink,
	openLogDirectory,
	relaunchApp,
	resetApplication,
	showConfirmDialog,
	triggerNotification,
} from './system-utils';

describe('system-utils', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Mock window.Notification for Tauri 2 plugin-notification
		// @ts-expect-error
		window.Notification = {
			permission: 'default',
			requestPermission: vi.fn(() => Promise.resolve('granted')),
		};

		mockIPC((cmd) => {
			if (cmd === 'plugin:dialog|message') return Promise.resolve('Yes');
			if (cmd === 'plugin:notification|is_permission_granted')
				return Promise.resolve(true);
			if (cmd === 'plugin:notification|request_permission')
				return Promise.resolve('granted');
			if (cmd === 'plugin:opener|open_url') return Promise.resolve(null);
			if (cmd === 'plugin:process|exit') return Promise.resolve(null);
			if (cmd === 'plugin:process|restart') return Promise.resolve(null);
			if (cmd === 'notify') return Promise.resolve(null);
			if (cmd === 'open_log_dir') return Promise.resolve(null);
			if (cmd === 'open_data_dir') return Promise.resolve(null);
			if (cmd === 'reset_application') return Promise.resolve(null);
			if (cmd === 'get_cli_status')
				return Promise.resolve({ installed: false, version: null });
			if (cmd === 'install_cli') return Promise.resolve(null);
		});
	});

	describe('triggerNotification', () => {
		it('triggers notification when permission is granted', async () => {
			let capturedNotify: unknown = null;
			// @ts-expect-error
			window.Notification.permission = 'granted';

			mockIPC((cmd, args) => {
				if (cmd === 'notify') {
					capturedNotify = args;
					return Promise.resolve(null);
				}
			});

			await triggerNotification('Title', 'Body');

			expect(capturedNotify).toEqual({ title: 'Title', body: 'Body' });
		});

		it('requests permission if not granted and triggers notification if user grants it', async () => {
			let capturedRequest = false;
			// @ts-expect-error
			window.Notification.permission = 'default';
			// @ts-expect-error
			vi.spyOn(window.Notification, 'requestPermission').mockImplementation(
				() => {
					capturedRequest = true;
					return Promise.resolve('granted');
				},
			);

			mockIPC((cmd) => {
				if (cmd === 'notify') return Promise.resolve(null);
			});

			await triggerNotification('Title', 'Body');

			expect(capturedRequest).toBe(true);
		});

		it('calls backend even if permission is denied (relying on backend fallbacks)', async () => {
			let capturedNotify = false;
			// @ts-expect-error
			window.Notification.permission = 'denied';

			mockIPC((cmd) => {
				if (cmd === 'notify') {
					capturedNotify = true;
					return Promise.resolve(null);
				}
			});

			await triggerNotification('Title', 'Body');

			expect(capturedNotify).toBe(true);
		});
	});

	describe('showConfirmDialog', () => {
		it('calls ask plugin (message) with correct parameters', async () => {
			let capturedArgs: unknown = null;
			mockIPC((cmd, args) => {
				if (cmd === 'plugin:dialog|message') {
					capturedArgs = args;
					return Promise.resolve('Yes');
				}
			});

			const result = await showConfirmDialog('Message', 'Title');

			expect((capturedArgs as Record<string, unknown>).message).toBe('Message');
			expect((capturedArgs as Record<string, unknown>).title).toBe('Title');
			expect(result).toBe(true);
		});
	});

	describe('openLogDirectory', () => {
		it('calls openLogDir command', async () => {
			let captured = false;
			mockIPC((cmd) => {
				if (cmd === 'open_log_dir') {
					captured = true;
					return Promise.resolve(null);
				}
			});
			await openLogDirectory();
			expect(captured).toBe(true);
		});
	});

	describe('openDataDirectory', () => {
		it('calls openDataDir command', async () => {
			let captured = false;
			mockIPC((cmd) => {
				if (cmd === 'open_data_dir') {
					captured = true;
					return Promise.resolve(null);
				}
			});
			await openDataDirectory();
			expect(captured).toBe(true);
		});
	});

	describe('openExternalLink', () => {
		it('calls openUrl plugin', async () => {
			let capturedUrl: string | null = null;
			mockIPC((cmd, args) => {
				if (cmd === 'plugin:opener|open_url') {
					capturedUrl = args.url;
					return Promise.resolve(null);
				}
			});
			await openExternalLink('https://example.com');
			expect(capturedUrl).toBe('https://example.com');
		});
	});

	describe('exitApp', () => {
		it('calls exit plugin', async () => {
			let capturedCode: number | null = null;
			mockIPC((cmd, args) => {
				if (cmd === 'plugin:process|exit') {
					capturedCode = args.code;
					return Promise.resolve(null);
				}
			});
			await exitApp();
			expect(capturedCode).toBe(0);
		});
	});

	describe('relaunchApp', () => {
		it('calls restart plugin', async () => {
			let captured = false;
			mockIPC((cmd) => {
				if (cmd === 'plugin:process|restart') {
					captured = true;
					return Promise.resolve(null);
				}
			});
			await relaunchApp();
			expect(captured).toBe(true);
		});
	});

	describe('resetApplication', () => {
		it('calls resetApplication command', async () => {
			let captured = false;
			mockIPC((cmd) => {
				if (cmd === 'reset_application') {
					captured = true;
					return Promise.resolve(null);
				}
			});
			await resetApplication();
			expect(captured).toBe(true);
		});
	});

	describe('getCliStatus', () => {
		it('calls get_cli_status command', async () => {
			mockIPC((cmd) => {
				if (cmd === 'get_cli_status')
					return Promise.resolve({ installed: true, version: '0.1.0' });
			});
			const result = await getCliStatus();
			expect(result).toEqual({ installed: true, version: '0.1.0' });
		});
	});

	describe('installCli', () => {
		it('calls install_cli command', async () => {
			let captured = false;
			mockIPC((cmd) => {
				if (cmd === 'install_cli') {
					captured = true;
					return Promise.resolve(null);
				}
			});
			await installCli();
			expect(captured).toBe(true);
		});
	});
});
