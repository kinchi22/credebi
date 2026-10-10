'use client';

import { ListIcon, Logo, MenuIcon, SearchIcon, SignOutIcon, SlidersIcon } from '@repo/ui';
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
  { href: SIGNED_IN_HOME, label: en.sidebar.entries, icon: <ListIcon /> },
  { href: ENTRY_SEARCH_PATH, label: en.sidebar.entrySearch, icon: <SearchIcon size={18} /> },
  { href: SETTINGS_PATH, label: en.sidebar.settings, icon: <SlidersIcon /> },
] as const;

const LOGO_HEIGHT = 40;
const BAR_LOGO_HEIGHT = 32;

const ON_DARK_FOCUS = 'focus-visible:outline-focus-on-dark';
const SIDEBAR_ITEM = `flex items-center gap-2.5 rounded-control px-2.5 py-2 ${ON_DARK_FOCUS}`;
const IDLE_TONE = 'text-text-muted-on-dark hover:bg-ground-dark-hover hover:text-text-on-dark';
const ACTIVE_LINK = `${SIDEBAR_ITEM} bg-ground-dark-raised font-medium text-text-on-dark`;
const IDLE_LINK = `${SIDEBAR_ITEM} ${IDLE_TONE}`;
const QUIET_BUTTON = `${SIDEBAR_ITEM} w-full ${typeClasses['body-sm']} ${IDLE_TONE}`;
const ICON_BUTTON = `-ml-2 inline-flex size-10 items-center justify-center rounded-control text-text-on-dark ${ON_DARK_FOCUS}`;
const SIDEBAR = 'flex-col gap-7 bg-ground-dark px-3 pt-5 pb-4 text-text-on-dark';
const WIDE_SIDEBAR = `hidden ${SIDEBAR} wide:sticky wide:top-0 wide:flex wide:h-screen wide:w-58 wide:shrink-0 wide:overflow-y-auto`;

function SidebarNav({ signOut, className, firstLink, onFollow }: SidebarNavProps): ReactNode {
  const pathname = usePathname();

  return (
    <nav aria-label={en.sidebar.ariaLabel} className={className}>
      <span className="flex px-2">
        <Logo variant="horizontal" tone="reverse" name={en.app.name} height={LOGO_HEIGHT} />
      </span>
      <ul className={`flex flex-col gap-0.5 ${typeClasses['body-sm']}`}>
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
                <span className={current ? 'flex text-accent' : 'flex'}>{link.icon}</span>
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
        onClick={drawer.closeOnScrim}
        className="m-0 h-full max-h-none w-64 max-w-[calc(100%-3rem)] rounded-r-panel border-0 bg-ground-dark p-0 backdrop:bg-ground-dark/60"
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
