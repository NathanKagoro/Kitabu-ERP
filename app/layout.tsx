import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { AppProvider } from '@/components/app-provider';
import { ErrorReporting } from '@/components/error-reporting';
import { ServiceWorker } from '@/components/service-worker';
import { ToastProvider } from '@/components/ui/toast';

import './globals.css';

export const metadata: Metadata = {
  title: 'Hesabu',
  description: 'Biashara yako, mkononi',
  applicationName: 'Hesabu',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Hesabu', statusBarStyle: 'default' },
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProvider>
            <ToastProvider>{children}</ToastProvider>
            <ServiceWorker />
            <ErrorReporting />
          </AppProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
