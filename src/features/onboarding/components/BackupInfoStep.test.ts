// SPDX-License-Identifier: MIT
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import BackupInfoStep from './BackupInfoStep.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string) => key),
}));

describe('BackupInfoStep', () => {
	it('renders backup info content', () => {
		render(BackupInfoStep);

		expect(screen.getByText('backupInfoStep.title')).toBeTruthy();
		expect(screen.getByText('backupInfoStep.runsSilently')).toBeTruthy();
	});
});
