import localFont from 'next/font/local';
import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';
import { en } from '../messages/en';
import './globals.css';

const sora = localFont({
  src: [
    { path: './fonts/Sora-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Sora-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-sora',
  display: 'swap',
});

const dmMono = localFont({
  src: [{ path: './fonts/DMMono-Regular.woff2', weight: '400', style: 'normal' }],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata = {
  title: { template: en.app.titleTemplate, default: en.app.name },
  description: en.app.description,
  applicationName: en.app.name,
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en" className={`${sora.variable} ${dmMono.variable}`}>
      <body className={`bg-white ${typeClasses.body} text-neutral-900 antialiased`}>{children}</body>
    </html>
  );
}
