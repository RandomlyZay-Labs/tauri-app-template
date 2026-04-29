import { expect, test } from '@playwright/test';
import { injectMockIpc } from './mock-ipc';

test.describe('Edge Cases & Resiliency', () => {
	test.beforeEach(async ({ page }) => {
		// Mark onboarding as completed to skip it in all edge-case tests
		await page.addInitScript(() => {
			window.localStorage.setItem(
				'ui-storage',
				JSON.stringify({
					state: { onboardingCompleted: true },
					version: 0,
				}),
			);
		});
	});

	test('network degradation: download guard', async ({ page }) => {
		await injectMockIpc(page);
		await page.goto('/');

		// 1. Fill in some data
		await page
			.getByPlaceholder('https://example.com/file.zip')
			.fill('https://test.com/large-file.bin');
		await page.getByRole('button', { name: 'Browse', exact: true }).click();

		// 2. Go offline via native event
		await page.evaluate(() => {
			window.dispatchEvent(new Event('offline'));
		});

		// 3. Attempt to download
		await page.getByRole('button', { name: 'Download', exact: true }).click();

		// 4. Verify offline toast
		await expect(page.getByText(/You are currently offline/i)).toBeVisible();
	});

	test('command palette: search & destructive actions', async ({ page }) => {
		await injectMockIpc(page);
		await page.goto('/');

		// 1. Open palette
		await page.keyboard.press('Control+k');
		await expect(page.getByPlaceholder('Type a command')).toBeVisible();

		// 2. Fuzzy matching: "stgs" -> "Settings"
		await page.keyboard.type('stgs', { delay: 50 });
		await expect(
			page.getByRole('option').filter({ hasText: /Settings/i }),
		).toBeVisible();

		// 3. Clear and test empty results
		await page
			.getByPlaceholder('Type a command')
			.fill('non-existent-command-12345');
		// Check for empty results
		await expect(page.locator('[data-slot="command-empty"]')).toBeVisible();

		// 4. Destructive: Prune Backups
		await page.getByPlaceholder('Type a command').fill('Prune');
		await expect(
			page.getByRole('option').filter({ hasText: /Prune/i }),
		).toBeVisible();
		await page.keyboard.press('Enter');

		// Since we mocked pruneBackups to return 0 in mock-ipc, it should show a success toast
		await expect(page.getByText(/Backup deleted/i)).toBeVisible();

		// 5. Destructive: Reset Application
		await page.keyboard.press('Control+k');
		await expect(page.getByPlaceholder('Type a command')).toBeVisible();
		await page.getByPlaceholder('Type a command').fill('Reset');
		await expect(
			page.getByRole('option').filter({ hasText: /Reset/i }),
		).toBeVisible();
		await page.keyboard.press('Enter');

		// Verify it called resetApplication (check if palette closed)
		await expect(page.getByPlaceholder('Type a command')).not.toBeVisible();
	});

	test('AppImage integration failure recovery', async ({ page }) => {
		// Mock integrateAppimage to FAIL using special __THROW__ property
		await injectMockIpc(page, {
			isAppimage: true,
			integrateAppimage: { __THROW__: 'Permission denied: /usr/local/bin' },
		});

		await page.goto('/#/settings');

		// 1. Ensure AppImage section is visible
		const integrateBtn = page.locator('#appimage-integrate-btn');
		await expect(integrateBtn).toBeVisible({ timeout: 10000 });

		// 2. Click Integrate
		await integrateBtn.click();

		// 3. Verify error handling (should show error toast)
		await expect(page.getByText(/Failed to add to PATH/i)).toBeVisible();
	});
});
