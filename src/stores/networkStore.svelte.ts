// SPDX-License-Identifier: MIT
const getInitialOfflineState = (): boolean => {
	if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
		return !navigator.onLine;
	}
	return false;
};

class NetworkStore {
	isOffline = $state(getInitialOfflineState());

	constructor() {
		if (typeof window !== 'undefined') {
			window.addEventListener('online', () => (this.isOffline = false));
			window.addEventListener('offline', () => (this.isOffline = true));
		}
	}

	setIsOffline(offline: boolean) {
		this.isOffline = offline;
	}
}

export const networkStore = new NetworkStore();
