import { mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commands } from '@/lib/ipc';

describe('ipc commands abstraction', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('delegates to Tauri invoke via the bindings', async () => {
		// Mock the underlying IPC call
		mockIPC((cmd, _args) => {
			if (cmd === 'get_log_path') {
				return '/mock/logs';
			}
			if (cmd === 'get_data_dir') {
				return '/mock/data';
			}
		});

		const logPath = await commands.getLogPath();
		const dataDir = await commands.getDataDir();

		expect(logPath).toBe('/mock/logs');
		expect(dataDir).toBe('/mock/data');
	});

	it('forwards arguments correctly to the backend', async () => {
		let capturedArgs: unknown = null;
		mockIPC((cmd, args) => {
			if (cmd === 'set_log_level') {
				capturedArgs = args;
				return null;
			}
		});

		await commands.setLogLevel('debug');

		expect(capturedArgs).toEqual({ level: 'debug' });
	});

	it('propagates errors from the backend correctly', async () => {
		mockIPC((cmd, _args) => {
			if (cmd === 'get_log_path') {
				// Simulate a Tauri error (rejection)
				throw 'Backend error message';
			}
		});

		await expect(commands.getLogPath()).rejects.toBe('Backend error message');
	});
});
