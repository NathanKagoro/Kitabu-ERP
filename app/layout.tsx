import type { Metadata, Viewport } from 'next';

import { AppProvider } from '@/components/app-provider';
import { ErrorReporting } from '@/components/error-reporting';
import { LocaleProvider } from '@/components/locale-provider';
import { ServiceWorker } from '@/components/service-worker';
import { ThemeColor } from '@/components/theme-color';
import { ToastProvider } from '@/components/ui/toast';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';

import './globals.css';

export const metadata: Metadata = {
  // Absolute URLs for the link-preview image (set by the Pages build).
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: 'Kitabu',
  description: 'Biashara yako, mkononi',
  applicationName: 'Kitabu',
  appleWebApp: { capable: true, title: 'Kitabu', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom stays enabled: pinch-to-zoom is an accessibility feature, and locking
  // it to look "app-like" is not worth taking that away.
  maximumScale: 5,
  themeColor: '#0f6b3f',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The language is switched on the phone after load (see LocaleProvider).
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <body>
        <LocaleProvider>
          <AppProvider>
            <ThemeColor />
            <ToastProvider>{children}</ToastProvider>
            <ServiceWorker />
            <ErrorReporting />
          </AppProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
