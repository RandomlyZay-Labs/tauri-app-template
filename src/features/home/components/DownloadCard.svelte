<script lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { executeSafeAction } from '@/lib/async-utils';
import { t } from '@/lib/i18n';
import { commands } from '@/lib/ipc';
import { logger } from '@/lib/logger';
import { guardAction } from '@/lib/network-guard';
import { toast } from '@/lib/toast';
import { activityStore } from '@/stores/activityStore.svelte';
import { Download, FolderOpen, Loader2 } from '@lucide/svelte';
import { open } from '@tauri-apps/plugin-dialog';
import * as Card from '@/components/ui/card';

let url = $state('');
let destDir = $state('');
let submitting = $state(false);
async function handleBrowse() {
	const selected = await open({ directory: true, multiple: false });
	if (selected) {
		destDir = selected as string;
	}
}

function handleSubmit() {
	if (!url.trim() || !destDir) return;

	guardAction(() => {
		submitting = true;
		void logger.debug('[DownloadCard] Submitting download job', {
			url: url.trim(),
			destDir,
		});
		void executeSafeAction(
			async () => {
				const [job] = await Promise.all([
					commands.submitDownloadJob({
						url: url.trim(),
						destDir,
						filename: null,
					}),
					new Promise((resolve) => setTimeout(resolve, 500)),
				]);

				const activity = activityStore.activities[job.id];
				if (activity?.status !== 'failed') {
					toast.success(t('downloadCard.downloadSubmitted'));
				}

				url = '';
			},
			{
				errorMessage: t('downloadCard.failedToSubmit'),
				onSuccess: () => {
					submitting = false;
				},
				onError: () => {
					submitting = false;
				},
			},
		);
	});
}
</script>

<Card.Root class="card-hover-glow overflow-hidden border-t-2 border-t-blue-500/50">
	<Card.Header>
		<Card.Title class="flex items-center gap-3 text-2xl">
			<div class="flex size-9 items-center justify-center rounded-lg bg-blue-500/10">
				<Download class="size-5 text-blue-500" />
			</div>
			{t('downloadCard.title')}
		</Card.Title>
		<Card.Description>{t('downloadCard.description')}</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-4">
		<div class="space-y-1.5">
			<label for="download-url" class="text-sm font-medium leading-none">{t('downloadCard.url')}</label>
			<Input
				id="download-url"
				type="url"
				placeholder={t('downloadCard.urlPlaceholder')}
				bind:value={url}
			/>
		</div>

		<div class="space-y-1.5">
			<label for="download-dest" class="text-sm font-medium leading-none">{t('downloadCard.destination')}</label>
			<div class="flex gap-2">
				<Input
					id="download-dest"
					readonly
					placeholder={t('downloadCard.chooseDirPlaceholder')}
					value={destDir}
				/>
				<Button
					variant="outline"
					onclick={() => void handleBrowse()}
				>
					<FolderOpen class="mr-1.5 size-4" />
					{t('downloadCard.chooseDir')}
				</Button>
			</div>
		</div>

		<Button
			class="w-full"
			disabled={!url.trim() || !destDir || submitting}
			onclick={handleSubmit}
		>
			{#if submitting}
				<Loader2 class="mr-2 size-4 animate-spin" />
			{:else}
				<Download class="mr-2 size-4" />
			{/if}
			{submitting ? t('downloadCard.downloading') : t('downloadCard.download')}
		</Button>


	</Card.Content>
</Card.Root>
