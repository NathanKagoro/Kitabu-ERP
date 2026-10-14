import { whatsappLink } from './receipt';

/**
 * The operator's WhatsApp number, for "I can't sign in" and "I need a new
 * code". Set NEXT_PUBLIC_SUPPORT_WHATSAPP at build time (a GitHub Actions
 * variable for the Pages build). Unset: the support buttons are hidden.
 */
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '';

export function hasSupport(): boolean {
  return SUPPORT_WHATSAPP.trim().length > 0;
}

export function supportLink(message: string): string {
  return whatsappLink(message, SUPPORT_WHATSAPP);
}
