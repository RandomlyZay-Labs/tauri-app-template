// SPDX-License-Identifier: MIT
import {
	loadPersistedState,
	type PersistConfig,
	savePersistedState,
} from '@/lib/store-utils';
import { getSystemAnimationPreference } from '@/lib/utils';

interface AnimationPersistedState {
	animationsEnabled: boolean;
}

const persistConfig: PersistConfig<AnimationPersistedState> = {
	name: 'animation-storage',
};

class AnimationStore {
	animationsEnabled = $state(getSystemAnimationPreference());

	constructor() {
		this.applyClass(this.animationsEnabled);
		this.hydrate();
	}

	private applyClass(enabled: boolean) {
		const root = window.document.documentElement;
		if (enabled) {
			root.classList.remove('no-animations');
		} else {
			root.classList.add('no-animations');
		}
	}

	private async hydrate() {
		const saved = await loadPersistedState(persistConfig);
		if (saved.animationsEnabled !== undefined) {
			this.setAnimationsEnabled(saved.animationsEnabled);
		}
	}

	private persist() {
		void savePersistedState(persistConfig, {
			animationsEnabled: this.animationsEnabled,
		});
	}

	setAnimationsEnabled(enabled: boolean) {
		this.animationsEnabled = enabled;
		this.applyClass(enabled);
		this.persist();
	}
}

export const animationStore = new AnimationStore();
