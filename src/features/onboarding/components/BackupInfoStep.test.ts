import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import BackupInfoStep from './BackupInfoStep.svelte';

// Mock i18n
vi.mock('@/lib/i18n', () => ({
	t: vi.fn((key: string) => key),
}));

describe('BackupInfoStep', () => {
	it('renders backup info content', () => {
		render(BackupInfoStep, { onNext: vi.fn(), onBack: vi.fn() });

		expect(screen.getByText('backupInfoStep.title')).toBeTruthy();
		expect(screen.getByText('backupInfoStep.runsSilently')).toBeTruthy();
	});

	it('calls navigation callbacks', async () => {
		const onNext = vi.fn();
		const onBack = vi.fn();
		render(BackupInfoStep, { onNext, onBack });

		await fireEvent.click(screen.getByText('common.next'));
		expect(onNext).toHaveBeenCalled();

		await fireEvent.click(screen.getByText('common.back'));
		expect(onBack).toHaveBeenCalled();
	});
});
