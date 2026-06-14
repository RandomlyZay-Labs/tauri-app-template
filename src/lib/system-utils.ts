// SPDX-License-Identifier: MIT
import { ask } from '@tauri-apps/plugin-dialog';
import {
	isPermissionGranted,
	requestPermission,
} from '@tauri-apps/plugin-notification';
import { openUrl } from '@tauri-apps/plugin-opener';
import { exit, relaunch } from '@tauri-apps/plugin-process';
import { commands } from '@/lib/ipc';
import { logger } from '@/lib/logger';

/**
 * System utility functions for Tauri plugin interactions.
 * Plain exported async functions.
 */

export async function triggerNotification(title: string, body: string) {
	void logger.debug('[systemUtils] triggerNotification called', {
		title,
		body,
	});

	// Attempt to request permission, but don't block the call if it fails or is denied.
	// The backend 'notify' command implements a 'Dual Dispatch' strategy,
	// ensuring delivery via fallback (e.g., notify-send on Linux) even if the
	// standard plugin path is unavailable or blocked by permissions.
	if (!(await isPermissionGranted())) {
		await requestPermission();
	}

	await commands.notify(title, body);
}

export async function showConfirmDialog(message: string, title: string) {
	void logger.debug('[systemUtils] showConfirmDialog called', {
		title,
		message,
	});
	return await ask(message, { title, kind: 'info' });
}

export async function openLogDirectory() {
	void logger.debug('[systemUtils] openLogDirectory called');
	await commands.openLogDir();
}

export async function openDataDirectory() {
	void logger.debug('[systemUtils] openDataDirectory called');
	await commands.openDataDir();
}

export async function openExternalLink(url: string) {
	void logger.debug('[systemUtils] openExternalLink called', { url });
	await openUrl(url);
}

export async function exitApp() {
	void logger.debug('[systemUtils] exitApp called');
	await exit(0);
}

export async function relaunchApp() {
	void logger.debug('[systemUtils] relaunchApp called');
	await relaunch();
}

export async function resetApplication() {
	void logger.debug('[systemUtils] resetApplication called');
	await commands.resetApplication();
}

export async function getCliStatus() {
	void logger.debug('[systemUtils] getCliStatus called');
	return await commands.getCliStatus();
}

export async function installCli() {
	void logger.debug('[systemUtils] installCli called');
	await commands.installCli();
}
