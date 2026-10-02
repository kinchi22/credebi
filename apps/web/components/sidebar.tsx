'use client';

import { Logo, MenuIcon, SignOutIcon } from '@repo/ui';
import { typeClasses } from '@repo/ui/type-classes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, type RefObject, useId, useRef } from 'react';
import { en } from '../messages/en';
import { ENTRY_SEARCH_PATH, SETTINGS_PATH, SIGNED_IN_HOME } from '../server/return-path';
import { useModalDialog } from './modal-dialog';

export type SidebarProps = {
  readonly signOut: () => Promise<void>;
};

type SidebarNavProps = SidebarProps & {
  readonly className: string;
  readonly firstLink?: RefObject<HTMLAnchorElement | null>;
  readonly onFollow?: () => void;
};

const LINKS = [
  { href: SIGNED_IN_HOME, label: en.sidebar.entries },
  { href: ENTRY_SEARCH_PATH, label: en.sidebar.entrySearch },
  { href: SETTINGS_PATH, label: en.sidebar.settings },
] as const;

const LOGO_HEIGHT = 40;
const BAR_LOGO_HEIGHT = 32;

const ON_DARK_FOCUS = 'focus-visible:outline-focus-on-dark';
const LINK = `flex items-center rounded px-3 py-2 ${ON_DARK_FOCUS}`;
const ACTIVE_LINK = `${LINK} bg-ground-dark-raised font-semibold text-text-on-dark`;
const IDLE_LINK = `${LINK} text-text-muted-on-dark hover:text-text-on-dark`;
const QUIET_BUTTON = `inline-flex items-center gap-2 rounded px-3 py-1 ${typeClasses['body-sm']} text-text-muted-on-dark hover:text-text-on-dark ${ON_DARK_FOCUS}`;
const ICON_BUTTON = `-ml-2 inline-flex size-10 items-center justify-center rounded text-text-on-dark ${ON_DARK_FOCUS}`;
const SIDEBAR = 'flex-col gap-4 bg-ground-dark p-4 text-text-on-dark';
const WIDE_SIDEBAR = `hidden ${SIDEBAR} wide:sticky wide:top-0 wide:flex wide:h-screen wide:w-56 wide:shrink-0 wide:overflow-y-auto`;

function SidebarNav({ signOut, className, firstLink, onFollow }: SidebarNavProps): ReactNode {
  const pathname = usePathname();

  return (
    <nav aria-label={en.sidebar.ariaLabel} className={className}>
      <Logo variant="horizontal" tone="reverse" name={en.app.name} height={LOGO_HEIGHT} />
      <ul className={`flex flex-col gap-1 ${typeClasses['body-sm']}`}>
        {LINKS.map((link, index) => {
          const current = link.href === pathname;
          return (
            <li key={link.href}>
              <Link
                ref={index === 0 ? firstLink : undefined}
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={current ? ACTIVE_LINK : IDLE_LINK}
                onClick={() => {
                  onFollow?.();
                }}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <form action={signOut} className="mt-auto border-t border-ground-dark-raised pt-3">
        <button type="submit" className={QUIET_BUTTON}>
          <SignOutIcon />
          {en.sidebar.signOut}
        </button>
      </form>
    </nav>
  );
}

export function Sidebar({ signOut }: SidebarProps): ReactNode {
  const drawerId = useId();
  const drawer = useModalDialog();
  const firstLink = useRef<HTMLAnchorElement>(null);

  return (
    <>
      <div className="flex h-14 items-center gap-2 bg-ground-dark px-4 wide:hidden">
        <button
          type="button"
          aria-label={en.sidebar.menu}
          aria-expanded={drawer.open}
          aria-controls={drawerId}
          onClick={(event) => {
            drawer.show(event.currentTarget);
            firstLink.current?.focus();
          }}
          className={ICON_BUTTON}
        >
          <MenuIcon />
        </button>
        <span className={drawer.open ? 'invisible' : undefined}>
          <Logo variant="horizontal" tone="reverse" name={en.app.name} height={BAR_LOGO_HEIGHT} />
        </span>
      </div>
      <SidebarNav signOut={signOut} className={WIDE_SIDEBAR} />
      <dialog
        {...drawer.dialogProps}
        id={drawerId}
        className="m-0 h-full max-h-none w-64 max-w-[calc(100%-3rem)] border-0 bg-ground-dark p-0 backdrop:bg-ground-dark/60"
      >
        <SidebarNav
          signOut={signOut}
          className={`flex h-full ${SIDEBAR} overflow-y-auto`}
          firstLink={firstLink}
          onFollow={drawer.close}
        />
      </dialog>
    </>
  );
}
