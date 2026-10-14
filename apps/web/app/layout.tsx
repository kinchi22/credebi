import localFont from 'next/font/local';
import { typeClasses } from '@repo/ui/type-classes';
import { type Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import './globals.css';

const plexSans = localFont({
  src: [
    { path: './fonts/IBMPlexSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexSans-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/IBMPlexSans-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

const plexMono = localFont({
  src: [
    { path: './fonts/IBMPlexMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexMono-Medium.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return {
    title: { template: t('titleTemplate'), default: t('name') },
    description: t('description'),
    applicationName: t('name'),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  const language = await getLocale();
  return (
    <html lang={language} className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className={`bg-ground ${typeClasses.body} text-text antialiased`}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
