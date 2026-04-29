// SPDX-License-Identifier: MIT
/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module '*.css' {
	const content: string;
	export default content;
}
