'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';

import { LOCALE_COOKIE, LOCALES } from '@/lib/i18n/config';

const schema = z.enum(LOCALES);

export async function setLocale(locale: string): Promise<void> {
  const parsed = schema.parse(locale);
  const store = await cookies();
  store.set(LOCALE_COOKIE, parsed, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365 * 2,
    sameSite: 'lax',
  });
}
