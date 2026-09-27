import Link from 'next/link';
import { type ReactNode } from 'react';
import { en } from '../messages/en';

export type SidebarProps = {
  readonly signOut: () => Promise<void>;
};

const LINKS = [
  { href: '/entries', label: en.sidebar.entries },
  { href: '/entries/search', label: en.sidebar.entrySearch },
  { href: '/settings', label: en.sidebar.settings },
] as const;

export function Sidebar({ signOut }: SidebarProps): ReactNode {
  return (
    <nav
      aria-label={en.sidebar.label}
      className="flex flex-col gap-2 border-b border-neutral-200 p-4 md:w-48 md:border-r md:border-b-0"
    >
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
