import { Logo } from '@repo/ui';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { en } from '../messages/en';
import { ENTRY_SEARCH_PATH, SETTINGS_PATH, SIGNED_IN_HOME } from '../server/return-path';

export type SidebarProps = {
  readonly signOut: () => Promise<void>;
};

const LINKS = [
  { href: SIGNED_IN_HOME, label: en.sidebar.entries },
  { href: ENTRY_SEARCH_PATH, label: en.sidebar.entrySearch },
  { href: SETTINGS_PATH, label: en.sidebar.settings },
] as const;

export function Sidebar({ signOut }: SidebarProps): ReactNode {
  return (
    <nav
      aria-label={en.sidebar.ariaLabel}
      className="flex flex-col gap-2 border-b border-neutral-200 p-4 md:w-48 md:border-r md:border-b-0"
    >
      <Logo variant="horizontal" tone="reverse" name={en.app.name} height={40} />
      <ul className="flex flex-col gap-1 text-sm">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut}>
        <button type="submit" className="rounded border border-neutral-300 px-3 py-1 text-sm">
          {en.sidebar.signOut}
        </button>
      </form>
    </nav>
  );
}
