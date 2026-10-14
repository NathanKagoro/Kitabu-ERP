import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE } from './config';

/**
 * Used only at build time, to write the static HTML. That HTML is always in
 * Swahili; a phone set to English switches on the client (see
 * components/locale-provider.tsx), because a static host has no cookies to read.
 */
export default getRequestConfig(async () => {
  const messages = (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;
  return { locale: DEFAULT_LOCALE, messages, timeZone: 'Africa/Dar_es_Salaam' };
});
