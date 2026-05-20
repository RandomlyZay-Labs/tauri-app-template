<script lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { commands } from '@/lib/ipc';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';
import { Eye, KeyRound, Save, Trash2 } from '@lucide/svelte';

import * as Card from '@/components/ui/card';

let secretKey = $state('');
let secretValue = $state('');

function handleSetSecret() {
	if (!secretKey.trim()) return;
	void logger.debug('[SecureStorageCard] User initiated setSecret', {
		key: secretKey.trim(),
	});
	void executeSafeAction(
		() => commands.setSecret(secretKey.trim(), secretValue),
		{
			successMessage: t('debugSettings.secretSaved'),
			errorMessage: t('debugSettings.failedSecretOp'),
		},
	);
}

function handleGetSecret() {
	if (!secretKey.trim()) return;
	void logger.debug('[SecureStorageCard] User initiated getSecret', {
		key: secretKey.trim(),
	});
	void executeSafeAction(
		async () => {
			const value = await commands.getSecret(secretKey.trim());
			toast.info(t('debugSettings.secretValue_result', { value }));
		},
		{ errorMessage: t('debugSettings.failedSecretOp') },
	);
}

function handleDeleteSecret() {
	if (!secretKey.trim()) return;
	void logger.debug('[SecureStorageCard] User initiated deleteSecret', {
		key: secretKey.trim(),
	});
	void executeSafeAction(() => commands.deleteSecret(secretKey.trim()), {
		successMessage: t('debugSettings.secretDeleted'),
		errorMessage: t('debugSettings.failedSecretOp'),
	});
}
</script>

<Card.Root class="card-hover-glow overflow-hidden border-t-2 border-t-amber-500/50">
	<Card.Header>
		<Card.Title class="flex items-center gap-3 text-2xl">
			<div class="flex size-9 items-center justify-center rounded-lg bg-amber-500/10">
				<KeyRound class="size-5 text-amber-500" />
			</div>
			{t('debugSettings.secureStorage')}
		</Card.Title>
		<Card.Description>{t('debugSettings.secureStorageDescription')}</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-4">
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="space-y-1.5">
				<label for="secret-key" class="text-sm font-medium leading-none">{t('debugSettings.secretKey')}</label>
				<Input
					id="secret-key"
					placeholder={t('debugSettings.secretKeyPlaceholder')}
					bind:value={secretKey}
				/>
			</div>
			<div class="space-y-1.5">
				<label for="secret-value" class="text-sm font-medium leading-none">{t('debugSettings.secretValue')}</label>
				<Input
					id="secret-value"
					placeholder={t('debugSettings.secretValuePlaceholder')}
					bind:value={secretValue}
				/>
			</div>
		</div>
		<div class="flex flex-wrap gap-3">
			<Button
				variant="outline"
				class="group/btn relative flex-1 gap-2 border-emerald-500/30 bg-emerald-500/5 text-emerald-600 transition-all hover:bg-emerald-500 hover:text-white dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white"
				onclick={handleSetSecret}
				disabled={!secretKey.trim()}
			>
				<Save class="size-4 transition-transform group-hover/btn:scale-110" />
				{t('debugSettings.setSecret')}
			</Button>

			<Button
				variant="outline"
				class="group/btn relative flex-1 gap-2 border-blue-500/30 bg-blue-500/5 text-blue-600 transition-all hover:bg-blue-500 hover:text-white dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white"
				onclick={handleGetSecret}
				disabled={!secretKey.trim()}
			>
				<Eye class="size-4 transition-transform group-hover/btn:scale-110" />
				{t('debugSettings.getSecret')}
			</Button>

			<Button
				variant="outline"
				class="group/btn relative flex-1 gap-2 border-rose-500/30 bg-rose-500/5 text-rose-600 transition-all hover:bg-rose-500 hover:text-white dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white"
				onclick={handleDeleteSecret}
				disabled={!secretKey.trim()}
			>
				<Trash2 class="size-4 transition-transform group-hover/btn:scale-110" />
				{t('debugSettings.deleteSecret')}
			</Button>
		</div>
	</Card.Content>
</Card.Root>
