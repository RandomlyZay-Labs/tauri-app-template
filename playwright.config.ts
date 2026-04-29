import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 2,
	workers: process.env.CI ? 1 : 4,
	reporter: [['dot'], ['html', { open: 'never' }]],
	use: {
		// Base URL to use in actions like `await page.goto('/')`.
		// This assumes you are running the vite dev server on 1420
		baseURL: 'http://localhost:1420',
		trace: 'on-first-retry',
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: 'pnpm dev',
		url: 'http://localhost:1420',
		reuseExistingServer: !process.env.CI,
		// Provide a timeout for startup
		timeout: 120 * 1000,
	},
});
