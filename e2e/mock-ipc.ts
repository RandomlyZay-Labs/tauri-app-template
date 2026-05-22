import type { Page } from '@playwright/test';
import type { Commands } from '../src/lib/ipc';

/**
 * Default mock responses for Tauri commands.
 * These are used by the mock IPC layer to simulate the backend.
 */
export const MOCK_IPC_DEFAULTS: Partial<Commands> = {
	async getLogPath() {
		return '/mock/system/logs';
	},
	async getDataDir() {
		return '/mock/data';
	},
	async openLogDir() {
		return null;
	},
	async openDataDir() {
		return null;
	},
	async resetApplication() {
		return null;
	},
	async listBackups() {
		return [];
	},
	async createBackup() {
		return {
			id: 'mock-backup',
			name: 'mock-backup.db',
			path: '/mock/path',
			size_bytes: 1024,
			created_at: new Date().toISOString(),
			is_manual: true,
			label: null,
		};
	},
	async pruneBackups() {
		return 0;
	},
	async deleteBackup() {
		return null;
	},
	async restoreBackup() {
		return null;
	},
	async setTraySettings() {
		return null;
	},
	async watchPath(_path: string) {
		return null;
	},
	async unwatchPath(_path: string) {
		return null;
	},
	async getCliStatus() {
		return { installed: false, version: null };
	},
	async installCli() {
		return null;
	},
	async notify(_title: string, _body: string) {
		return null;
	},

	async cancelJob(_jobId: string) {
		return null;
	},
	async listJobs() {
		return [];
	},
	async getJob(jobId: string) {
		return {
			id: jobId,
			kind: 'download',
			status: 'completed',
			progress: 100,
			message: 'Mock job',
			metadata: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
	},

	async exportDiagnostics() {
		return true;
	},
	async setSecret(_key: string, _value: string) {
		return null;
	},
	async getSecret(_key: string) {
		return 'mock-secret-value';
	},
	async deleteSecret(_key: string) {
		return null;
	},
	async setLogLevel(_level: string) {
		return null;
	},
	async getVersion() {
		return '0.1.0';
	},
	async getSystemTheme() {
		return null;
	},
	async setTheme(_theme) {
		return null;
	},
};

/**
 * Injects a robust mock IPC layer into the page.
 * This aligns with Tauri's official mockIPC implementation but is optimized for Playwright.
 */
export async function injectMockIpc(
	page: Page,
	customMocks: Record<string, unknown> = {},
) {
	await page.addInitScript((injectedMocks) => {
		// --- TAURI MOCK CORE ---
		// We implement the core Tauri IPC bridge protocol to intercept all invoke calls.

		window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};

		const listeners = new Map<string, number[]>();
		const callbacks = new Map<number, (data: unknown) => void>();

		function registerCallback(callback: (data: unknown) => void, once = false) {
			const id = Math.floor(Math.random() * 4294967295);
			callbacks.set(id, (data) => {
				if (once) callbacks.delete(id);
				callback(data);
			});
			return id;
		}

		function runCallback(id: number, data: unknown) {
			const callback = callbacks.get(id);
			if (callback) callback(data);
		}

		/**
		 * Triggers a Tauri event from the mock backend.
		 * Tests can call this via page.evaluate() to simulate real backend events.
		 */
		// @ts-expect-error
		window.__TRIGGER_MOCK_EVENT__ = (event: string, payload: unknown) => {
			const eventListeners = listeners.get(event) || [];
			for (const handlerId of eventListeners) {
				runCallback(handlerId, { event, payload });
			}
		};

		const mockCommands: Record<string, unknown> = {
			getLogPath: () => '/mock/system/logs',
			getDataDir: () => '/mock/data',
			openLogDir: () => null,
			openDataDir: () => null,
			resetApplication: () => null,
			listBackups: () => [],
			createBackup: () => ({
				id: 'mock-backup',
				name: 'mock-backup.db',
				path: '/mock/path',
				size_bytes: 1024,
				created_at: new Date().toISOString(),
				is_manual: true,
				label: null,
			}),
			pruneBackups: () => 0,
			deleteBackup: () => null,
			restoreBackup: () => null,
			setTraySettings: () => null,
			watchPath: (_args: { path: string }) => {
				// We don't use setTimeout here to avoid flakiness.
				// Tests should explicitly trigger the event if they want to test the watcher reaction.
				return null;
			},
			unwatchPath: () => null,
			getCliStatus: () => ({ installed: false, version: null }),
			installCli: () => null,
			notify: () => null,

			cancelJob: () => null,
			listJobs: () => [],
			getJob: (args: { jobId: string }) => ({
				id: args.jobId,
				kind: 'download',
				status: 'completed',
				progress: 100,
				message: 'Mock job',
				metadata: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}),

			exportDiagnostics: () => true,
			setSecret: () => null,
			getSecret: () => 'mock-secret-value',
			deleteSecret: () => null,
			setLogLevel: () => null,
			getVersion: () => '0.1.0',
			getSystemTheme: () => null,
			setTheme: () => null,
		};

		// Expose for runtime overrides by tests via standard DOM events
		window.addEventListener('tauri-mock-update', (event: Event) => {
			const { command, response } = (event as CustomEvent).detail;
			if (command) {
				// biome-ignore lint/suspicious/noExplicitAny: E2E testing
				(window as any).__TAURI_MOCK_COMMANDS__[command] =
					typeof response === 'function' ? response : () => response;
			}
		});

		window.addEventListener('tauri-mock-event', (event: Event) => {
			const { event: tauriEvent, payload } = (event as CustomEvent).detail;
			if (tauriEvent) {
				// @ts-expect-error
				window.__TRIGGER_MOCK_EVENT__(tauriEvent, payload);
			}
		});

		// Expose for runtime overrides by tests (legacy support, discouraged)
		// @ts-expect-error
		window.__TAURI_MOCK_COMMANDS__ = mockCommands;

		// Merge injected mocks
		for (const [key, value] of Object.entries(injectedMocks)) {
			if (value && typeof value === 'object' && '__THROW__' in value) {
				// @ts-expect-error
				mockCommands[key] = () => {
					// @ts-expect-error
					throw new Error(value.__THROW__);
				};
			} else {
				// @ts-expect-error
				mockCommands[key] = typeof value === 'function' ? value : () => value;
			}
		}

		async function mockInvoke(cmd: string, args: unknown = {}) {
			const typedArgs = args as Record<string, unknown>;

			// Handle Event Plugin (Tauri v2 protocol)
			if (cmd.startsWith('plugin:event|')) {
				switch (cmd) {
					case 'plugin:event|listen': {
						const event = typedArgs.event as string;
						const handler = typedArgs.handler as number;
						if (!listeners.has(event)) listeners.set(event, []);
						listeners.get(event)?.push(handler);
						return handler;
					}
					case 'plugin:event|unlisten': {
						const event = typedArgs.event as string;
						const id = typedArgs.id as number;
						const eventListeners = listeners.get(event);
						if (eventListeners) {
							const index = eventListeners.indexOf(id);
							if (index !== -1) eventListeners.splice(index, 1);
						}
						return null;
					}
				}
			}

			// Handle Updater Plugin (Tauri v2 protocol)
			if (cmd.startsWith('plugin:updater|')) {
				console.log(`[MOCK_IPC] Handling updater: ${cmd}`, args);
			}

			// Handle Notifications
			if (cmd.includes('notification')) {
				console.log(`[MOCK_IPC] Handling notification: ${cmd}`, args);
				if (cmd.toLowerCase().includes('is_permission_granted')) return true;
				if (cmd.toLowerCase().includes('request_permission')) return 'granted';
			}

			// Handle Dialogs
			if (cmd === 'plugin:dialog|open') {
				console.log(`[MOCK_IPC] Handling dialog: ${cmd}`, args);
				return '/mock/selected/path';
			}
			if (cmd === 'plugin:dialog|message' || cmd === 'plugin:dialog|ask')
				return 'Yes';
			if (cmd === 'plugin:dialog|save') return '/mock/path/to/save.log';

			// Handle Opener
			if (cmd === 'plugin:opener|open_url') {
				// @ts-expect-error
				window.__LAST_OPENED_URL__ = typedArgs.url;
				return null;
			}

			// Handle App Version
			if (cmd === 'plugin:app|get_version') return '0.1.0';

			// Command Mapping
			// We extract the command name from "plugin:name|command" or use it directly
			const commandName = cmd.includes('|') ? cmd.split('|')[1] : cmd;

			// Handle both snake_case and camelCase
			let handler = mockCommands[commandName];
			if (!handler) {
				const camelCaseName = commandName.replace(/_([a-z])/g, (g) =>
					g[1].toUpperCase(),
				);
				handler = mockCommands[camelCaseName];
			}

			if (handler) {
				try {
					const result =
						typeof handler === 'function' ? handler(args) : handler;
					// Ensure we return a promise if it's an async mock
					const resolved = await Promise.resolve(result);
					console.log(`[MOCK_IPC] Success: ${cmd}`, { args, result: resolved });
					return resolved;
				} catch (e: unknown) {
					const error = e instanceof Error ? e.message : String(e);
					console.error(`[MOCK_IPC] Error: ${cmd}`, { args, error });
					throw error;
				}
			}

			console.warn(`[MOCK_IPC] Unhandled command: ${cmd}`, args);
			return null;
		}

		// Inject into Tauri internals
		Object.assign(window.__TAURI_INTERNALS__, {
			invoke: mockInvoke,
			transformCallback: registerCallback,
			unregisterCallback: (id: number) => callbacks.delete(id),
			runCallback,
			callbacks,
		});

		// Fallbacks for compatibility
		// @ts-expect-error
		window.__TAURI__ = window.__TAURI__ || {};
		// @ts-expect-error
		window.__TAURI__.invoke = mockInvoke;

		// @ts-expect-error
		window.__TAURI_IPC__ = (message: {
			cmd: string;
			callback: number;
			error: number;
			payload: unknown;
		}) => {
			mockInvoke(message.cmd, message.payload)
				.then((res) => {
					runCallback(message.callback, res);
				})
				.catch((err) => {
					runCallback(message.error, err);
				});
		};

		// Mock standard Notification API
		// @ts-expect-error
		window.Notification = {
			permission: 'granted',
			requestPermission: async () => 'granted',
		};
	}, customMocks);
}
