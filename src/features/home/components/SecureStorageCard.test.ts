// SPDX-License-Identifier: MIT
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '@/lib/ipc';
import { toast } from '@/lib/toast';
import SecureStorageCard from './SecureStorageCard.svelte';

vi.mock('@/lib/ipc', () => ({
	commands: {
		setSecret: vi.fn(),
		getSecret: vi.fn(),
		deleteSecret: vi.fn(),
	},
}));

vi.mock('@/lib/toast', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
	},
}));

vi.mock('@/lib/i18n', () => ({
	t: (key: string, args?: Record<string, unknown>) =>
		args ? `${key}_${JSON.stringify(args)}` : key,
}));

vi.mock('@/lib/logger', () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
	},
}));

describe('SecureStorageCard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders correctly', () => {
		render(SecureStorageCard);
		expect(screen.getByText('debugSettings.secureStorage')).toBeDefined();
	});

	it('buttons are disabled when key is empty', () => {
		render(SecureStorageCard);
		expect(
			(screen.getByText('debugSettings.setSecret') as HTMLButtonElement)
				.disabled,
		).toBe(true);
		expect(
			(screen.getByText('debugSettings.getSecret') as HTMLButtonElement)
				.disabled,
		).toBe(true);
		expect(
			(screen.getByText('debugSettings.deleteSecret') as HTMLButtonElement)
				.disabled,
		).toBe(true);
	});

	it('sets a secret', async () => {
		vi.mocked(commands.setSecret).mockResolvedValue(null);
		render(SecureStorageCard);

		const keyInput = screen.getByPlaceholderText(
			'debugSettings.secretKeyPlaceholder',
		);
		const valueInput = screen.getByPlaceholderText(
			'debugSettings.secretValuePlaceholder',
		);

		await fireEvent.input(keyInput, { target: { value: 'my-key' } });
		await fireEvent.input(valueInput, { target: { value: 'my-value' } });

		const setBtn = screen.getByText('debugSettings.setSecret');
		await fireEvent.click(setBtn);

		expect(commands.setSecret).toHaveBeenCalledWith('my-key', 'my-value');
	});

	it('gets a secret', async () => {
		vi.mocked(commands.getSecret).mockResolvedValue('retrieved-value');
		render(SecureStorageCard);

		const keyInput = screen.getByPlaceholderText(
			'debugSettings.secretKeyPlaceholder',
		);
		await fireEvent.input(keyInput, { target: { value: 'my-key' } });

		const getBtn = screen.getByText('debugSettings.getSecret');
		await fireEvent.click(getBtn);

		expect(commands.getSecret).toHaveBeenCalledWith('my-key');
		await waitFor(() => {
			expect(toast.info).toHaveBeenCalledWith(
				'debugSettings.secretValue_result_{"value":"retrieved-value"}',
				{ shouldCopy: true },
			);
		});
	});

	it('deletes a secret', async () => {
		vi.mocked(commands.deleteSecret).mockResolvedValue(null);
		render(SecureStorageCard);

		const keyInput = screen.getByPlaceholderText(
			'debugSettings.secretKeyPlaceholder',
		);
		await fireEvent.input(keyInput, { target: { value: 'my-key' } });

		const deleteBtn = screen.getByText('debugSettings.deleteSecret');
		await fireEvent.click(deleteBtn);

		expect(commands.deleteSecret).toHaveBeenCalledWith('my-key');
	});
});
