import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from './config';

/**
 * No locale prefix in the URL. Language is a setting the owner picks once, kept
 * in a cookie, so that an installed PWA and a shared receipt link never carry
 * /sw/ or /en/ around with them.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages, timeZone: 'Africa/Dar_es_Salaam' };
});
