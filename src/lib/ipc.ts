/**
 * IPC Abstraction Layer
 *
 * This module wraps the auto-generated Tauri bindings.
 * It serves to decouple the application code from the direct bindings file.
 */

import { commands as tauriCommands } from '@/bindings';

export type Commands = typeof tauriCommands;

/**
 * The IPC implementation.
 * In test environments, Tauri's official mocking utilities should be used
 * to intercept these calls at the core level.
 */
export const commands = tauriCommands;
