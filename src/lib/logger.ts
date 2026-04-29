import { debug, error, info, trace, warn } from '@tauri-apps/plugin-log';

/**
 * A wrapper around the Tauri Log plugin.
 * This ensures that logs are sent to the Rust backend and stored/printed according
 * to the backend configuration (stdout + file rotation).
 */
export const logger = {
	info: async (message: string, ...args: unknown[]) => {
		console.log(message, ...args);
		await info(formatMessage(message, args));
	},
	warn: async (message: string, ...args: unknown[]) => {
		console.warn(message, ...args);
		await warn(formatMessage(message, args));
	},
	error: async (message: string, ...args: unknown[]) => {
		console.error(message, ...args);
		await error(formatMessage(message, args));
	},
	debug: async (message: string, ...args: unknown[]) => {
		console.debug(message, ...args);
		await debug(formatMessage(message, args));
	},
	trace: async (message: string, ...args: unknown[]) => {
		console.trace(message, ...args);
		await trace(formatMessage(message, args));
	},
};

function formatMessage(message: string, args: unknown[]): string {
	let formatted = message;
	if (args.length > 0) {
		try {
			formatted = `${message} ${args
				.map((a) => {
					if (a instanceof Error) {
						return JSON.stringify(
							{
								message: a.message,
								stack: a.stack,
								name: a.name,
								// Cast to unknown first, then Record to satisfy no-explicit-any
								...(a as unknown as Record<string, unknown>),
							},
							Object.getOwnPropertyNames(a),
						);
					}
					return JSON.stringify(a);
				})
				.join(' ')}`;
		} catch {
			formatted = `${message} [Circular/Unserializable]`;
		}
	}
	return sanitize(formatted);
}

function sanitize(str: string): string {
	let sanitized = str;

	// Scrub Linux/macOS home directories
	sanitized = sanitized.replace(/(?:\/home\/|\/Users\/)[^/]+/gi, '~');
	// Scrub Windows user directories
	sanitized = sanitized.replace(/[a-zA-Z]:\\[Uu]sers\\[^/\\]+/gi, '~');

	// Scrub tokens (Bearer, Basic)
	sanitized = sanitized.replace(
		/(Bearer |Basic )[a-zA-Z0-9\-._~+/]+=*/gi,
		'$1<REDACTED>',
	);

	// Scrub key/secret/token/password patterns
	sanitized = sanitized.replace(
		/(["']?(?:api[_-]?key|secret|token|password)["']?\s*(?::|=|=>)\s*["']?)[a-zA-Z0-9\-._~+/]+=*(["']?)/gi,
		'$1<REDACTED>$2',
	);

	return sanitized;
}
