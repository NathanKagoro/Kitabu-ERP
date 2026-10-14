export const LOCALES = ['sw', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Swahili is the product, English is the fallback -- not the other way round. */
export const DEFAULT_LOCALE: Locale = 'sw';

/** Where the phone remembers its language (localStorage). */
export const LOCALE_STORAGE_KEY = 'kitabu_locale';

export const LOCALE_NAMES: Record<Locale, string> = {
  sw: 'Kiswahili',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
