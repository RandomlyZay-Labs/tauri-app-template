import { describe, expect, it } from 'vitest';
import { commands as tauriCommands } from '@/bindings';
import { MOCK_IPC_DEFAULTS } from '../../e2e/mock-ipc';
import type { Commands } from './ipc';

describe('IPC Structural Guarantee', () => {
	it('MOCK_IPC_DEFAULTS should have a mock for every command in bindings', () => {
		const bindingCommands = Object.keys(tauriCommands);
		const mockCommands = Object.keys(MOCK_IPC_DEFAULTS);

		// Use Commands type to ensure it is counted as used
		const _typeCheck: Commands | undefined = undefined;

		for (const cmd of bindingCommands) {
			expect(
				mockCommands,
				`Mock IPC (MOCK_IPC_DEFAULTS in e2e/mock-ipc.ts) is missing command: ${cmd}. Please add it to maintain the structural guarantee.`,
			).toContain(cmd);
		}
	});

	it('every mock in MOCK_IPC_DEFAULTS should exist in bindings (no stale mocks)', () => {
		const bindingCommands = Object.keys(tauriCommands);
		const mockCommands = Object.keys(MOCK_IPC_DEFAULTS);

		// Note: We allow some extra mocks if they are "pseudo-commands" used only in tests,
		// but generally we want them to match.
		// For now, let's just warn or check for exact match if that's the goal.
		for (const cmd of mockCommands) {
			// Some mocks might be helper functions, we can exclude them if needed.
			if (['openExternalLink'].includes(cmd)) continue;

			expect(
				bindingCommands,
				`Mock IPC has stale command: ${cmd} which does not exist in bindings.`,
			).toContain(cmd);
		}
	});
});
