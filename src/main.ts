// SPDX-License-Identifier: MIT
import { mount } from 'svelte';
import App from './App.svelte';
import './index.css';
import './lib/i18n';
import { uiStore } from './stores/uiStore.svelte';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// Prevent easy devtools activation (context menu and shortcuts)
window.addEventListener('contextmenu', (e) => {
	if (!uiStore.contextMenuEnabled) e.preventDefault();
});

const blockDevTools = (e: KeyboardEvent) => {
	if (uiStore.contextMenuEnabled) return;

	const isDevTools =
		e.code === 'F12' ||
		e.key === 'F12' ||
		(e.ctrlKey &&
			e.shiftKey &&
			(e.code === 'KeyI' ||
				e.code === 'KeyJ' ||
				e.code === 'KeyC' ||
				e.key.toLowerCase() === 'i')) ||
		(e.metaKey &&
			e.altKey &&
			(e.code === 'KeyI' ||
				e.code === 'KeyJ' ||
				e.code === 'KeyC' ||
				e.key.toLowerCase() === 'i'));

	if (isDevTools) {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
		return false;
	}
};

window.addEventListener('keydown', blockDevTools, { capture: true });
window.addEventListener('keypress', blockDevTools, { capture: true });
window.addEventListener('keyup', blockDevTools, { capture: true });

const app = mount(App, { target: root });

export default app;
