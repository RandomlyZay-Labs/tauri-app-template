import { expect, test } from '@playwright/test';
import { injectMockIpc } from './mock-ipc';

test.describe('Comprehensive User Flows', () => {
	test.beforeEach(async ({ page }) => {
		await injectMockIpc(page);
		await page.addInitScript(() => {
			window.localStorage.setItem(
				'ui-storage',
				JSON.stringify({
					state: { onboardingCompleted: true, telemetryEnabled: true },
					version: 0,
				}),
			);
			window.localStorage.setItem(
				'animation-storage',
				JSON.stringify({
					state: { animationsEnabled: false },
					version: 0,
				}),
			);
		});
	});

	test('Dashboard - Downloads flow', async ({ page }) => {
		await page.goto('/');

		// Fill URL
		await page.getByLabel(/^URL$/i).fill('https://example.com/file.zip');

		// Browse for destination (mocked to return /mock/selected/path)
		await page.getByRole('button', { name: /^Browse$/i }).click();
		await expect(page.locator('#download-dest')).toHaveValue(
			'/mock/selected/path',
		);

		// Submit download
		await page.getByRole('button', { name: /^Download$/i }).click();
		await expect(page.getByText(/Download job submitted/i)).toBeVisible();

		// Manually trigger progress events to simulate backend activity
		await page.evaluate(
			(detail) => {
				window.dispatchEvent(new CustomEvent('tauri-mock-event', { detail }));
			},
			{
				event: 'job://progress',
				payload: {
					jobId: 'mock-job-1',
					kind: 'download',
					status: 'running',
					progress: 50,
					message: 'Downloading...',
					updatedAt: new Date().toISOString(),
				},
			},
		);

		// Open Activity Center
		await page.getByLabel(/Open Activity Center/i).click();
		// Specifically look for the job title in the sheet, not the card on home page
		await expect(
			page.getByRole('dialog').getByText('Download', { exact: true }),
		).toBeVisible();

		// Cancel the job
		const cancelButton = page
			.getByRole('dialog')
			.getByRole('button', { name: /^Cancel$/i });
		await expect(cancelButton).toBeVisible();
		await cancelButton.click();

		// Manually trigger cancellation event
		await page.evaluate(
			(detail) => {
				window.dispatchEvent(new CustomEvent('tauri-mock-event', { detail }));
			},
			{
				event: 'job://progress',
				payload: {
					jobId: 'mock-job-1',
					kind: 'download',
					status: 'cancelled',
					progress: 50,
					message: 'Cancelled by user',
					updatedAt: new Date().toISOString(),
				},
			},
		);

		await expect(
			page.getByRole('dialog').getByText('Cancelled', { exact: true }),
		).toBeVisible();
	});

	test('Dashboard - Secure Storage flow', async ({ page }) => {
		await page.goto('/');

		const keyInput = page.getByLabel(/^Key$/i);
		const valueInput = page.getByLabel(/^Value$/i);

		// Set secret
		await keyInput.fill('my-key');
		await valueInput.fill('my-value');
		await expect(keyInput).toHaveValue('my-key');
		await expect(valueInput).toHaveValue('my-value');
		await page.getByRole('button', { name: /^Set$/i }).click();
		await expect(page.getByText(/Secret saved/i)).toBeVisible();

		// Retrieve secret
		await page.getByRole('button', { name: /^Get$/i }).click();
		await expect(page.getByText(/Value: mock-secret-value/i)).toBeVisible();

		// Delete secret
		await page.getByRole('button', { name: /^Delete$/i }).click();
		await expect(page.getByText(/Secret deleted/i)).toBeVisible();
	});

	test('Dashboard - File Watcher flow', async ({ page }) => {
		await page.goto('/');

		// Add watched path
		await page.getByRole('button', { name: /Browse Folder/i }).click();
		await page.getByRole('button', { name: /^Watch$/i }).click();
		await expect(
			page.locator('.font-mono').getByText('/mock/selected/path'),
		).toBeVisible();

		// Manually trigger file system change event
		await page.evaluate(
			(detail) => {
				window.dispatchEvent(new CustomEvent('tauri-mock-event', { detail }));
			},
			{
				event: 'fs://change',
				payload: '/mock/selected/path/file.txt',
			},
		);

		await expect(page.getByText(/File Watcher Event/i).first()).toBeVisible();
		await expect(
			page.getByText(/File changed: \/mock\/selected\/path\/file.txt/i).first(),
		).toBeVisible();

		// Unwatch path
		await page.getByLabel(/Unwatch/i).click();
		await expect(
			page.locator('.font-mono').getByText('/mock/selected/path'),
		).not.toBeVisible();
	});

	test('Activity Center - active jobs and cancellation', async ({ page }) => {
		await page.goto('/');

		// Trigger a job
		await page.getByLabel(/^URL$/i).fill('https://example.com/test.zip');
		await expect(page.getByLabel(/^URL$/i)).toHaveValue(
			'https://example.com/test.zip',
		);
		// Browse for destination (needed to enable download button)
		await page.getByRole('button', { name: /^Browse$/i }).click();
		await expect(page.locator('#download-dest')).toHaveValue(
			'/mock/selected/path',
		);

		await page.getByRole('button', { name: /^Download$/i }).click();
		await expect(page.getByText(/Download job submitted/i)).toBeVisible();

		// Manually trigger progress event to ensure it's tracked
		await page.evaluate(
			(detail) => {
				window.dispatchEvent(new CustomEvent('tauri-mock-event', { detail }));
			},
			{
				event: 'job://progress',
				payload: {
					jobId: 'mock-job-1',
					kind: 'download',
					status: 'running',
					progress: 10,
					message: 'Starting...',
					updatedAt: new Date().toISOString(),
				},
			},
		);

		// Open sheet
		await page.getByLabel(/Open Activity Center/i).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		// Specifically look for the job title in the sheet
		await expect(dialog.getByText('Download', { exact: true })).toBeVisible();

		// Cancel from sheet
		const cancelButton = dialog.getByRole('button', { name: /^Cancel$/i });
		await expect(cancelButton).toBeVisible();
		await cancelButton.click();

		// Manually trigger cancellation event
		await page.evaluate(
			(detail) => {
				window.dispatchEvent(new CustomEvent('tauri-mock-event', { detail }));
			},
			{
				event: 'job://progress',
				payload: {
					jobId: 'mock-job-1',
					kind: 'download',
					status: 'cancelled',
					progress: 10,
					message: 'Cancelled by user',
					updatedAt: new Date().toISOString(),
				},
			},
		);

		await expect(dialog.getByText('Cancelled', { exact: true })).toBeVisible();
	});

	test('Settings - Resets and CLI Management', async ({ page }) => {
		await page.goto('/#/settings');
		await page.getByTestId('tab-trigger-general').click();

		// Reset preferences
		const resetPrefsBtn = page.locator('#reset-prefs-btn');
		await expect(resetPrefsBtn).toBeVisible();
		await resetPrefsBtn.click();

		const prefDialog = page.getByRole('dialog');
		await expect(prefDialog).toBeVisible();
		await page
			.getByRole('button', { name: 'Confirm Reset', exact: true })
			.click();
		await expect(prefDialog).not.toBeVisible();
		await expect(page.getByText(/Preferences have been reset/i)).toBeVisible();

		// Factory Reset (Danger Zone)
		const clearDataBtn = page.locator('#clear-data-btn');
		await expect(clearDataBtn).toBeVisible();
		await clearDataBtn.click();

		const deleteDialog = page.getByRole('dialog');
		await expect(deleteDialog).toBeVisible();

		await deleteDialog
			.getByPlaceholder(/Yes, delete all my data/i)
			.fill('Yes, delete all my data');
		await deleteDialog
			.getByRole('button', { name: 'Delete Everything', exact: true })
			.click();

		// Wait for dialog to close
		await expect(deleteDialog).not.toBeVisible();

		// Toggle telemetry
		const telemetrySwitch = page.locator('#telemetry-switch');
		await telemetrySwitch.click();
		await expect(page.getByText(/Telemetry updated/i)).toBeVisible();

		// CLI Management (Mock not installed)
		await injectMockIpc(page, {
			get_cli_status: { installed: false, version: null },
		});
		await page.reload();
		await page.getByTestId('tab-trigger-cli').click();

		await expect(page.getByText(/CLI Integration/i)).toBeVisible();
		await expect(page.getByText(/Not Installed/i)).toBeVisible();

		const installBtn = page.getByRole('button', { name: /Install CLI/i });
		await expect(installBtn).toBeVisible();

		// Mock success after install using the dynamic update event
		await page.evaluate(() => {
			window.dispatchEvent(
				new CustomEvent('tauri-mock-update', {
					detail: {
						command: 'get_cli_status',
						response: { installed: true, version: '0.1.0' },
					},
				}),
			);
		});

		await installBtn.click();
		await expect(page.getByText(/CLI installed successfully/i)).toBeVisible();
		await expect(page.getByText(/Up to Date/i)).toBeVisible();
		await expect(page.getByText(/v0\.1\.0/)).toBeVisible();
	});

	test('Debug Settings - tray, notifications, dialogs, logs, crash', async ({
		page,
	}) => {
		await page.goto('/#/settings');
		await page.getByTestId('tab-trigger-debug').click();
		// Wait for Debug content to be visible
		await expect(page.getByText('Debug Tools', { exact: true })).toBeVisible();

		// Toggle tray
		const traySwitch = page
			.locator('button[role="switch"]')
			.filter({ visible: true })
			.first();
		await traySwitch.click();

		// Test notifications
		await page
			.getByRole('button', { name: 'Notification', exact: true })
			.click();
		await expect(page.getByText(/System notification sent/i)).toBeVisible();

		// Test dialogs
		await page
			.getByRole('button', { name: 'Native Dialog', exact: true })
			.click();
		// Native dialog is mocked to return true
		await expect(page.getByText(/Native dialog result: Yes/i)).toBeVisible();

		// Export logs
		await page
			.getByRole('button', { name: 'Export Logs', exact: true })
			.click();
		await expect(page.getByText(/Logs exported successfully/i)).toBeVisible();

		// Crash test
		await page
			.getByRole('button', { name: 'Trigger Error', exact: true })
			.click();
		await expect(page.getByText(/Something went wrong/i)).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Reload', exact: true }),
		).toBeVisible();
	});
});
