'use client';

import { Logo, SignOutIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useId, useState } from 'react';
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

const ON_DARK_FOCUS = 'focus-visible:outline-focus-on-dark';
const LINK = `flex items-center rounded px-3 py-2 ${ON_DARK_FOCUS}`;
const ACTIVE_LINK = `${LINK} bg-ground-dark-raised font-semibold text-text-on-dark`;
const IDLE_LINK = `${LINK} text-text-muted-on-dark hover:text-text-on-dark`;
const QUIET_BUTTON = `inline-flex items-center gap-2 rounded px-3 py-1 ${typeClasses['body-sm']} text-text-muted-on-dark hover:text-text-on-dark ${ON_DARK_FOCUS}`;
const NAV = 'flex-col gap-4 bg-ground-dark p-4 text-text-on-dark wide:static wide:flex wide:w-56';
const OPEN_NAV = `${NAV} fixed inset-y-0 left-0 z-10 flex w-64 overflow-y-auto`;
const CLOSED_NAV = `${NAV} hidden`;

export function Sidebar({ signOut }: SidebarProps): ReactNode {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerId = useId();

  return (
    <>
      <div className="flex items-center justify-between bg-ground-dark p-4 wide:hidden">
        <Logo variant="horizontal" tone="reverse" name={en.app.name} height={32} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => {
            setOpen((wasOpen) => !wasOpen);
          }}
          className={`relative z-20 ${QUIET_BUTTON}`}
        >
          {en.sidebar.menu}
        </button>
      </div>
      <nav id={drawerId} aria-label={en.sidebar.ariaLabel} className={open ? OPEN_NAV : CLOSED_NAV}>
        <Logo variant="horizontal" tone="reverse" name={en.app.name} height={40} />
        <ul className={`flex flex-col gap-1 ${typeClasses['body-sm']}`}>
          {LINKS.map((link) => {
            const current = link.href === pathname;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? 'page' : undefined}
                  className={current ? ACTIVE_LINK : IDLE_LINK}
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <form action={signOut}>
          <button type="submit" className={QUIET_BUTTON}>
            <SignOutIcon />
            {en.sidebar.signOut}
          </button>
        </form>
      </nav>
    </>
  );
}
