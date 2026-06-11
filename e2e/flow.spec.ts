// SPDX-License-Identifier: MIT
import { expect, test } from '@playwright/test';
import { injectMockIpc } from './mock-ipc';

test.describe('App Flow', () => {
	test('complete walkthrough', async ({ page }) => {
		await injectMockIpc(page);
		// 1. Initial Load & Onboarding
		await page.goto('/');
		await expect(page).toHaveTitle(/Tauri/);
		await expect(
			page.getByRole('heading', { name: 'Welcome to Tauri App Template' }),
		).toBeVisible();

		// 2. Navigation & Sidebar
		await page.getByRole('button', { name: 'Get Started' }).click();
		await expect(page.getByRole('button', { name: 'Dark' })).toBeVisible();

		// 3. Theme Selection
		await page.getByRole('button', { name: 'Dark' }).click();
		await page.getByRole('button', { name: 'Next' }).first().click();
		await expect(
			page.getByRole('heading', { name: 'Experience' }),
		).toBeVisible();

		// 4. Animations Selection
		await page.getByRole('button', { name: 'Next' }).first().click();
		await expect(
			page.getByRole('heading', { name: 'Help us improve' }),
		).toBeVisible();

		// 5. Complete Onboarding
		await page.getByRole('button', { name: 'Next' }).first().click(); // Telemetry
		await expect(
			page.getByRole('heading', { name: 'Safe & Secure' }),
		).toBeVisible();

		await page.getByRole('button', { name: 'Next' }).first().click(); // Backups
		await expect(
			page.getByRole('heading', { name: "You're all set!" }),
		).toBeVisible();

		await page.getByRole('button', { name: 'Done' }).click(); // Finish

		// 6. Landing on Home Page
		await expect(page.getByText('Dashboard')).toBeVisible();

		// 7. Navigation to Settings
		await page.getByRole('link', { name: 'Settings' }).click();
		await expect(page.getByText('General')).toBeVisible();

		// 8. Command Palette Test
		await page.keyboard.press('Control+k');
		await expect(page.getByPlaceholder('Type a command')).toBeVisible();
		await page.keyboard.type('Home');
		await page.keyboard.press('Enter');
		await expect(page.getByText('Dashboard')).toBeVisible();
	});

	test('appearance toggling', async ({ page }) => {
		await injectMockIpc(page);
		await page.addInitScript(() => {
			window.localStorage.setItem(
				'ui-storage',
				JSON.stringify({
					state: { onboardingCompleted: true },
					version: 0,
				}),
			);
			window.localStorage.setItem(
				'backup-settings',
				JSON.stringify({
					enabled: false,
				}),
			);
		});

		await page.goto('/#/settings');
		await page.getByTestId('tab-trigger-appearance').click();

		// Check initial theme
		const html = page.locator('html').first();

		// Click the theme select trigger
		await page.locator('#theme-mode').click();

		// Select Light mode
		await page.getByRole('option', { name: /Light/i }).click();
		await expect(html).not.toHaveClass(/dark/);

		// Click the theme select trigger again
		await page.locator('#theme-mode').click();

		// Select Dark mode
		await page.getByRole('option', { name: /Dark/i }).click();
		await expect(html).toHaveClass(/dark/);

		// Animations switch
		const animationsToggle = page.locator('#animations-toggle');
		const isAnimationsChecked =
			(await animationsToggle.getAttribute('aria-checked')) === 'true';
		await animationsToggle.click();
		await expect(animationsToggle).toHaveAttribute(
			'aria-checked',
			isAnimationsChecked ? 'false' : 'true',
		);
	});

	test('backup destructive actions', async ({ page }) => {
		await injectMockIpc(page, {
			listBackups: [
				{
					id: 'mock-backup-123',
					name: 'mock.db',
					path: '/mock/path',
					size_bytes: 1024,
					created_at: new Date().toISOString(),
					is_manual: true,
					label: 'UNIQUE_LABEL_12345',
				},
			],
		});

		await page.addInitScript(() => {
			window.localStorage.setItem(
				'ui-storage',
				JSON.stringify({
					state: { onboardingCompleted: true },
					version: 0,
				}),
			);
			window.localStorage.setItem(
				'backup-settings',
				JSON.stringify({
					enabled: false,
				}),
			);
		});

		await page.goto('/#/settings');

		// Navigate to Backups tab
		await page.getByTestId('tab-trigger-backups').click();

		// Wait for the row to appear
		const label = page.getByText('UNIQUE_LABEL_12345').first();
		await expect(label).toBeVisible({ timeout: 15000 });
		const row = page.getByTestId('backup-row').filter({ has: label });

		// Restore
		await row.getByTestId('restore-btn').click();
		await expect(page.getByText(/Confirm Restore/i)).toBeVisible();
		// Use a more specific locator for the dialog button
		await page.getByRole('button', { name: /Restore & Restart/i }).click();

		// Delete
		await row.getByTestId('delete-btn').click();
		await expect(page.getByText(/Confirm Delete/i)).toBeVisible();
		await page
			.getByRole('button', { name: /Delete/i })
			.last()
			.click();
		await expect(page.getByText(/Backup deleted/i)).toBeVisible();
	});

	test('about page links', async ({ page }) => {
		await injectMockIpc(page);

		await page.addInitScript(() => {
			window.localStorage.setItem(
				'ui-storage',
				JSON.stringify({
					state: { onboardingCompleted: true },
					version: 0,
				}),
			);
			window.localStorage.setItem(
				'backup-settings',
				JSON.stringify({
					enabled: false,
				}),
			);
		});

		await page.goto('/#/about');

		// Kofi
		const kofiPromise = page.waitForEvent('console', (msg) =>
			msg.text().includes('ko-fi.com'),
		);
		await page.getByTestId('kofi-btn').click();
		await kofiPromise;

		// GitHub
		const githubPromise = page.waitForEvent('console', (msg) =>
			msg.text().includes('github.com'),
		);
		await page.getByTestId('github-btn').click();
		await githubPromise;
	});

	test('error payload mapping', async ({ page }) => {
		// Mock notify to throw a Validation error
		await injectMockIpc(page, {
			createBackup: {
				__THROW__: 'Manual backup label cannot be empty',
			},
		});

		await page.addInitScript(() => {
			window.localStorage.setItem(
				'ui-storage',
				JSON.stringify({
					state: { onboardingCompleted: true },
					version: 0,
				}),
			);
		});

		await page.goto('/#/settings');
		await page.getByTestId('tab-trigger-backups').click();

		// Open the manual backup dialog
		await page.getByRole('button', { name: /Create Backup/i }).click();

		// Type a name (even though it will fail)
		await page.getByPlaceholder(/e.g., Before Upgrade/i).fill('My Backup');
		await page.keyboard.press('Enter');

		// Assert toast appears with the specific error message
		// The executeSafeAction prepends the errorMessage "Failed to create backup"
		await expect(
			page.getByText(
				/Failed to create backup: Manual backup label cannot be empty/i,
			),
		).toBeVisible();
	});
});
