import { commands } from '@/lib/ipc';

let appVersion = $state('0.0.0');
let loaded = false;

export function getAppVersion(): string {
	if (!loaded) {
		loaded = true;
		commands
			.getVersion()
			.then((v) => {
				appVersion = v;
			})
			.catch((error) => {
				console.warn('Failed to get app version:', error);
			});
	}
	return appVersion;
}
