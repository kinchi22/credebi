'use client';

import { Logo, SignOutIcon } from '@repo/ui';
import { breakpoints } from '@repo/ui/tokens';
import { typeClasses } from '@repo/ui/type-classes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react';
import { en } from '../messages/en';
import { ENTRY_SEARCH_PATH, SETTINGS_PATH, SIGNED_IN_HOME } from '../server/return-path';

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
const WIDE_QUERY = `(min-width: ${String(breakpoints.wide)}px)`;

const ON_DARK_FOCUS = 'focus-visible:outline-focus-on-dark';
const LINK = `flex items-center rounded px-3 py-2 ${ON_DARK_FOCUS}`;
const ACTIVE_LINK = `${LINK} bg-ground-dark-raised font-semibold text-text-on-dark`;
const IDLE_LINK = `${LINK} text-text-muted-on-dark hover:text-text-on-dark`;
const QUIET_BUTTON = `inline-flex items-center gap-2 rounded px-3 py-1 ${typeClasses['body-sm']} text-text-muted-on-dark hover:text-text-on-dark ${ON_DARK_FOCUS}`;
const SIDEBAR = 'flex-col gap-4 bg-ground-dark p-4 text-text-on-dark';

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
      <form action={signOut}>
        <button type="submit" className={QUIET_BUTTON}>
          <SignOutIcon />
          {en.sidebar.signOut}
        </button>
      </form>
    </nav>
  );
}

export function Sidebar({ signOut }: SidebarProps): ReactNode {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const drawer = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  const close = (): void => {
    drawer.current?.close();
  };

  useEffect(() => {
    const wide = window.matchMedia(WIDE_QUERY);
    const closeWhenWide = (): void => {
      if (wide.matches) drawer.current?.close();
    };
    wide.addEventListener('change', closeWhenWide);
    return () => {
      wide.removeEventListener('change', closeWhenWide);
    };
  }, []);

  return (
    <>
      <div className="flex items-center justify-between bg-ground-dark p-4 wide:hidden">
        <span className={open ? 'invisible' : undefined}>
          <Logo variant="horizontal" tone="reverse" name={en.app.name} height={LOGO_HEIGHT} />
        </span>
        <button
          ref={menu}
          type="button"
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => {
            drawer.current?.showModal();
            setOpen(true);
            firstLink.current?.focus();
          }}
          className={QUIET_BUTTON}
        >
          {en.sidebar.menu}
        </button>
      </div>
      <SidebarNav signOut={signOut} className={`hidden ${SIDEBAR} wide:flex wide:w-56`} />
      <dialog
        ref={drawer}
        id={drawerId}
        onClose={() => {
          setOpen(false);
          menu.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="m-0 h-full max-h-none w-64 max-w-[calc(100%-3rem)] border-0 bg-ground-dark p-0 backdrop:bg-ground-dark/60"
      >
        <SidebarNav
          signOut={signOut}
          className={`flex h-full ${SIDEBAR} overflow-y-auto`}
          firstLink={firstLink}
          onFollow={close}
        />
      </dialog>
    </>
  );
}
