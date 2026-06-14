// SPDX-License-Identifier: MIT
import { expect, test } from '@playwright/test';
import { injectMockIpc } from './mock-ipc';

test('debug about page', async ({ page }) => {
	await injectMockIpc(page);

	await page.addInitScript(() => {
		window.localStorage.setItem(
			'ui-storage',
			JSON.stringify({ state: { onboardingCompleted: true }, version: 0 }),
		);
	});

	await page.goto('/#/about');

	const btn = page.getByTestId('kofi-btn');
	await expect(btn).toBeVisible();

	const kofiPromise = page.waitForEvent('console', (msg) =>
		msg.text().includes('ko-fi.com/randomlyzay'),
	);
	await btn.click();
	await kofiPromise;
});
