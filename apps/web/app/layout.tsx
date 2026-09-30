import { type ReactNode } from 'react';
import { en } from '../messages/en';
import './globals.css';

export const metadata = {
  title: { template: en.app.titleTemplate, default: en.app.name },
  description: en.app.description,
  applicationName: en.app.name,
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
