import { locale } from '@tauri-apps/plugin-os';
import i18n from 'i18next';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
const DEFAULT_LANGUAGE = 'en';

/**
 * Determine the user's preferred language code from navigator.language.
 *
 * @returns The browser's base language if it is included in SUPPORTED_LANGUAGES, otherwise DEFAULT_LANGUAGE.
 */
function detectLanguage(): string {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') {
		return DEFAULT_LANGUAGE;
	}

	const browserLang = navigator.language?.split('-')[0];
	if (
		browserLang &&
		(SUPPORTED_LANGUAGES as readonly string[]).includes(browserLang)
	) {
		return browserLang;
	}

	return DEFAULT_LANGUAGE;
}

void i18n.init({
	resources: {
		en: { translation: en },
		es: { translation: es },
	},
	lng: detectLanguage(),
	fallbackLng: DEFAULT_LANGUAGE,
	interpolation: {
		escapeValue: false,
	},
});

/**
 * Reactive translation function.
 * Use directly in Svelte components: t('key')
 */
export function t(key: string, options?: Record<string, unknown>): string {
	if (!i18n.isInitialized) {
		// Fallback to English keys during early initialization
		const keys = key.split('.');
		let current: unknown = en;
		for (const k of keys) {
			if (current && typeof current === 'object' && k in current) {
				current = (current as Record<string, unknown>)[k];
			} else {
				return key;
			}
		}
		return typeof current === 'string' ? current : key;
	}
	return i18n.t(key, options) as string;
}

function _changeLanguage(lng: string) {
	return i18n.changeLanguage(lng);
}

/**
 * Asynchronously query the native OS locale, and if it's one of the supported
 * languages, switch the i18n language to it.
 */
export async function syncLocaleWithSystem() {
	try {
		const sysLocale = await locale();
		if (sysLocale) {
			const lang = sysLocale.split('-')[0];
			if ((SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
				await i18n.changeLanguage(lang);
			}
		}
	} catch (e) {
		console.warn('[i18n] Failed to sync locale with system:', e);
	}
}
