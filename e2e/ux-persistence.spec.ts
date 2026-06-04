import { expect, test } from '@playwright/test';
import { injectMockIpc } from './mock-ipc';

test.describe('Expanded Features E2E', () => {
	test.beforeEach(async ({ page }) => {
		await injectMockIpc(page);
		// Bypass onboarding, set initial state, and disable animations for stable tests
		await page.addInitScript(() => {
			if (!window.localStorage.getItem('ui-storage')) {
				window.localStorage.setItem(
					'ui-storage',
					JSON.stringify({
						state: {
							onboardingCompleted: true,
							sidebarOpen: true,
							logLevel: 'error',
						},
						version: 0,
					}),
				);
			}
			if (!window.localStorage.getItem('animation-storage')) {
				window.localStorage.setItem(
					'animation-storage',
					JSON.stringify({
						state: {
							animationsEnabled: false,
						},
						version: 0,
					}),
				);
			}
		});
	});

	test('backup settings interactions', async ({ page }) => {
		await page.goto('/#/settings');
		await page.getByTestId('tab-trigger-backups').click();

		// 1. Toggle automated backups
		const autoBackupSwitch = page.getByRole('switch').first();
		await expect(autoBackupSwitch).toBeVisible();

		const isChecked =
			(await autoBackupSwitch.getAttribute('aria-checked')) === 'true';
		if (!isChecked) {
			await autoBackupSwitch.click();
		}
		await expect(autoBackupSwitch).toBeChecked();

		// 2. Interact with frequency and retention inputs
		const frequencyInput = page.getByRole('spinbutton').first();
		await expect(frequencyInput).toBeVisible();
		await expect(page.getByText('Every day')).toBeVisible();
		await frequencyInput.fill('48');
		await expect(page.getByText('Every 2 days')).toBeVisible();

		const retentionInput = page.getByRole('spinbutton').nth(1);
		await expect(retentionInput).toBeVisible();
		await expect(page.getByText('Keep last 5')).toBeVisible();
		await retentionInput.fill('10');
		await expect(page.getByText('Keep last 10')).toBeVisible();

		// 3. Manual backup creation
		await page.getByRole('button', { name: /Create Backup/i }).click();
		await expect(page.getByText('Create Manual Backup')).toBeVisible();

		const nameInput = page.locator('#backup-name');
		await nameInput.fill('Test E2E Backup');

		// To update mocks in the current page without reload, we dispatch a native event
		await page.evaluate(
			(detail) => {
				window.dispatchEvent(new CustomEvent('tauri-mock-update', { detail }));
			},
			{
				command: 'createBackup',
				response: {
					id: 'e2e-backup-id',
					name: 'e2e-backup.db',
					path: '/mock/e2e-backup.db',
					size_bytes: 5000,
					created_at: new Date().toISOString(),
					is_manual: true,
					label: 'Test E2E Backup',
				},
			},
		);

		await page.evaluate(
			(detail) => {
				window.dispatchEvent(new CustomEvent('tauri-mock-update', { detail }));
			},
			{
				command: 'listBackups',
				response: [
					{
						id: 'e2e-backup-id',
						name: 'e2e-backup.db',
						path: '/mock/e2e-backup.db',
						size_bytes: 5000,
						created_at: new Date().toISOString(),
						is_manual: true,
						label: 'Test E2E Backup',
					},
				],
			},
		);

		await page.getByRole('button', { name: 'Create Backup' }).nth(1).click();
		await expect(page.getByText('Manual backup created')).toBeVisible();

		// Verify row exists
		await expect(page.getByTestId('backup-row')).toBeVisible();
		await expect(page.getByText('Test E2E Backup')).toBeVisible();
	});

	test('debug settings log level toggle', async ({ page }) => {
		await page.goto('/#/settings');
		await page.getByTestId('tab-trigger-debug').click();

		// Find the switch near "Debug Mode" text
		const debugModeRow = page
			.locator('div')
			.filter({ hasText: /^Debug Mode$/ })
			.first();
		const debugSwitch = debugModeRow.locator('xpath=../..').getByRole('switch');

		// Wait for initial state to be stable
		await expect(debugSwitch).toBeVisible();

		// Toggle and verify switch state changes as the proxy for the command being sent
		await debugSwitch.click();
		await expect(debugSwitch).toBeChecked();
	});

	test('activity center job management', async ({ page }) => {
		// Mock initial activities
		await page.addInitScript(() => {
			window.localStorage.setItem(
				'activity-storage',
				JSON.stringify({
					state: {
						activities: {
							'job-1': {
								id: 'job-1',
								kind: 'download',
								label: 'Completed Job',
								status: 'completed',
								progress: 100,
								message: 'Finished',
								createdAt: Date.now() - 10000,
								updatedAt: Date.now() - 5000,
							},
							'job-2': {
								id: 'job-2',
								kind: 'download',
								label: 'Failed Job',
								status: 'failed',
								progress: 50,
								message: 'Error occurred',
								createdAt: Date.now() - 20000,
								updatedAt: Date.now() - 15000,
							},
							'job-3': {
								id: 'job-3',
								kind: 'download',
								label: 'Interrupted Job',
								status: 'interrupted',
								progress: 30,
								message: 'Interrupted',
								createdAt: Date.now() - 30000,
								updatedAt: Date.now() - 25000,
							},
						},
					},
					version: 0,
				}),
			);
		});

		await page.goto('/');

		// Open Activity Center
		await page.getByLabel('Open Activity Center').click();
		// Use more specific locator to avoid ambiguity
		await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();

		await expect(page.getByText('Completed Job')).toBeVisible();
		await expect(page.getByText('Failed Job')).toBeVisible();
		await expect(page.getByText('Interrupted Job')).toBeVisible();

		// 1. Test individual removal of the failed job
		const failedJobRow = page
			.getByTestId('activity-item')
			.filter({ hasText: 'Failed Job' })
			.first();
		await failedJobRow.hover();
		await failedJobRow.getByLabel('Remove activity').click();
		await expect(page.getByText('Failed Job')).not.toBeVisible();

		// 2. Test Clear Completed (should clear remaining terminal statuses: completed and interrupted)
		await page.getByRole('button', { name: 'Clear Completed' }).click();

		await expect(page.getByText('Completed Job')).not.toBeVisible();
		await expect(page.getByText('Interrupted Job')).not.toBeVisible();
		await expect(page.getByText('No recent activity')).toBeVisible();
	});

	test('sidebar expand/collapse and persistence', async ({ page }) => {
		await page.goto('/');

		const sidebar = page.locator('aside[aria-label="Sidebar"]');
		await expect(sidebar).toBeVisible();

		// 1. Verify initial expanded state
		await expect(page.getByText('Tauri App Template')).toBeVisible();

		const initialBox = await sidebar.boundingBox();
		expect(initialBox?.width).toBeGreaterThan(150);

		// 2. Collapse Sidebar
		await page.getByLabel('Collapse Sidebar').click();
		await expect(page.getByText('Tauri App Template')).not.toBeVisible();

		await expect
			.poll(async () => {
				const box = await sidebar.boundingBox();
				return box?.width;
			})
			.toBeLessThan(100);

		// 3. Verify persistence across reload
		await page.reload();
		// Wait for sidebar to be ready/visible instead of hard timeout
		await expect(sidebar).toBeVisible();

		await expect(page.getByText('Tauri App Template')).not.toBeVisible();
		const collapsedBox = await sidebar.boundingBox();
		expect(collapsedBox?.width).toBeLessThan(100);

		// 4. Expand again
		await page.getByLabel('Expand Sidebar').click();
		await expect(page.getByText('Tauri App Template')).toBeVisible();
		const expandedBox = await sidebar.boundingBox();
		expect(expandedBox?.width).toBeGreaterThan(150);
	});
});
