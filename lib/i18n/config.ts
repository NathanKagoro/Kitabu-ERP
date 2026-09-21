export const LOCALES = ['sw', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Swahili is the product, English is the fallback -- not the other way round. */
export const DEFAULT_LOCALE: Locale = 'sw';

export const LOCALE_COOKIE = 'hesabu_locale';

export const LOCALE_NAMES: Record<Locale, string> = {
  sw: 'Kiswahili',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
