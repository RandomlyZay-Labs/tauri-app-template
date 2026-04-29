// SPDX-License-Identifier: MIT
import { mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger, resetLoggerState } from '@/lib/logger';

const ipcLogSpy = vi.fn();
let shouldIpcReject = false;

mockIPC((cmd, args) => {
	if (cmd === 'plugin:log|log') {
		ipcLogSpy(args);
		if (shouldIpcReject) {
			return Promise.reject(new Error('IPC Failure'));
		}
		return Promise.resolve();
	}
});

beforeEach(() => {
	shouldIpcReject = false;
	resetLoggerState();
	vi.clearAllMocks();
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'debug').mockImplementation(() => {});
	vi.spyOn(console, 'trace').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('logger', () => {
	describe('log level methods', () => {
		it('logger.info logs to console and Tauri info', async () => {
			await logger.info('hello world');

			expect(console.log).toHaveBeenCalledWith('hello world');
			expect(ipcLogSpy).toHaveBeenCalledWith({
				level: 3,
				message: 'hello world',
				location: expect.any(String),
			});
		});

		it('logger.warn logs to console and Tauri warn', async () => {
			await logger.warn('warning message');

			expect(console.warn).toHaveBeenCalledWith('warning message');
			expect(ipcLogSpy).toHaveBeenCalledWith({
				level: 4,
				message: 'warning message',
				location: expect.any(String),
			});
		});

		it('logger.error logs to console and Tauri error', async () => {
			await logger.error('error message');

			expect(console.error).toHaveBeenCalledWith('error message');
			expect(ipcLogSpy).toHaveBeenCalledWith({
				level: 5,
				message: 'error message',
				location: expect.any(String),
			});
		});

		it('logger.debug logs to console and Tauri debug', async () => {
			await logger.debug('debug message');

			expect(console.debug).toHaveBeenCalledWith('debug message');
			expect(ipcLogSpy).toHaveBeenCalledWith({
				level: 2,
				message: 'debug message',
				location: expect.any(String),
			});
		});

		it('logger.trace logs to console and Tauri trace', async () => {
			await logger.trace('trace message');

			expect(console.trace).toHaveBeenCalledWith('trace message');
			expect(ipcLogSpy).toHaveBeenCalledWith({
				level: 1,
				message: 'trace message',
				location: expect.any(String),
			});
		});
	});

	describe('formatMessage', () => {
		it('formats additional arguments as JSON appended to the message', async () => {
			await logger.info('msg', { key: 'value' });

			expect(ipcLogSpy).toHaveBeenCalledWith(
				expect.objectContaining({ message: 'msg {"key":"value"}' }),
			);
		});

		it('formats multiple arguments separated by spaces', async () => {
			await logger.info('msg', 'arg1', 42);

			expect(ipcLogSpy).toHaveBeenCalledWith(
				expect.objectContaining({ message: 'msg "arg1" 42' }),
			);
		});

		it('formats Error instances with message, stack, and name', async () => {
			const err = new Error('test error');
			err.stack = 'Error: test error\n    at test';
			await logger.error('caught', err);

			const call = ipcLogSpy.mock.calls.find((c) => c[0].level === 5)[0] as {
				message: string;
			};
			expect(call.message).toContain('caught');
			expect(call.message).toContain('test error');
			expect(call.message).toContain('Error');
		});

		it('handles circular references gracefully', async () => {
			const circular: Record<string, unknown> = {};
			circular.self = circular;

			await logger.info('circular', circular);

			expect(ipcLogSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					message: 'circular [Circular/Unserializable]',
				}),
			);
		});

		it('returns just the message when no args are provided', async () => {
			await logger.info('simple');

			expect(ipcLogSpy).toHaveBeenCalledWith(
				expect.objectContaining({ message: 'simple' }),
			);
		});
	});

	describe('sanitize', () => {
		it('scrubs Linux home directories', async () => {
			await logger.info('path /home/username/docs/file.txt');

			const call = ipcLogSpy.mock.calls.find((c) =>
				c[0].message.includes('path'),
			)[0] as { message: string };
			expect(call.message).toContain('~/docs/file.txt');
			expect(call.message).not.toContain('username');
		});

		it('scrubs macOS home directories', async () => {
			await logger.info('path /Users/john/Documents');

			const call = ipcLogSpy.mock.calls.find((c) =>
				c[0].message.includes('path'),
			)[0] as { message: string };
			expect(call.message).toContain('~/Documents');
			expect(call.message).not.toContain('john');
		});

		it('scrubs Windows user directories', async () => {
			await logger.info('path C:\\Users\\admin\\Desktop');

			const call = ipcLogSpy.mock.calls.find((c) =>
				c[0].message.includes('path'),
			)[0] as { message: string };
			expect(call.message).toContain('~\\Desktop');
			expect(call.message).not.toContain('admin');
		});

		it('scrubs Bearer tokens', async () => {
			await logger.info('auth Bearer eyJhbGciOiJIUzI1NiJ9=');

			const call = ipcLogSpy.mock.calls.find((c) =>
				c[0].message.includes('auth'),
			)[0] as { message: string };
			expect(call.message).toContain('Bearer <REDACTED>');
			expect(call.message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
		});

		it('scrubs Basic auth tokens', async () => {
			await logger.info('auth Basic dXNlcjpwYXNz');

			const call = ipcLogSpy.mock.calls.find((c) =>
				c[0].message.includes('auth'),
			)[0] as { message: string };
			expect(call.message).toContain('Basic <REDACTED>');
			expect(call.message).not.toContain('dXNlcjpwYXNz');
		});

		it('scrubs api_key patterns', async () => {
			await logger.info('config api_key=sk_live_abc123xyz');

			const call = ipcLogSpy.mock.calls.find((c) =>
				c[0].message.includes('config'),
			)[0] as { message: string };
			expect(call.message).toContain('api_key=<REDACTED>');
			expect(call.message).not.toContain('sk_live_abc123xyz');
		});

		it('scrubs secret patterns', async () => {
			await logger.info('config "secret":"mysecretvalue123"');

			const call = ipcLogSpy.mock.calls.find((c) =>
				c[0].message.includes('config'),
			)[0] as { message: string };
			expect(call.message).toContain('<REDACTED>');
			expect(call.message).not.toContain('mysecretvalue123');
		});

		it('scrubs password patterns', async () => {
			await logger.info("auth password='hunter2abc'");

			const call = ipcLogSpy.mock.calls.find((c) =>
				c[0].message.includes('auth'),
			)[0] as { message: string };
			expect(call.message).toContain('<REDACTED>');
			expect(call.message).not.toContain('hunter2abc');
		});

		it('does not alter messages without sensitive data', async () => {
			await logger.info('normal log message');

			expect(ipcLogSpy).toHaveBeenCalledWith(
				expect.objectContaining({ message: 'normal log message' }),
			);
		});
	});

	describe('IPC error handling', () => {
		it('recovers gracefully from IPC logging failure and falls back to console', async () => {
			shouldIpcReject = true;

			// Should resolve and not throw an unhandled promise rejection
			await expect(logger.info('test failure')).resolves.toBeUndefined();

			// Should still log to console
			expect(console.log).toHaveBeenCalledWith('test failure');

			// Should log a one-time console.warn
			expect(console.warn).toHaveBeenCalledWith(
				'IPC logging is unavailable; falling back to console-only logging.',
				expect.any(Error),
			);

			// Subsequent logs should not call the IPC layer again
			ipcLogSpy.mockClear();
			await logger.info('another message');
			expect(ipcLogSpy).not.toHaveBeenCalled();
			expect(console.log).toHaveBeenCalledWith('another message');
		});
	});
});
