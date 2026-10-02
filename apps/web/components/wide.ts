import { breakpoints } from '@repo/ui/tokens';
import { useSyncExternalStore } from 'react';

export const WIDE_QUERY = `(min-width: ${String(breakpoints.wide)}px)`;

const subscribe = (onChange: () => void): (() => void) => {
  const wide = window.matchMedia(WIDE_QUERY);
  wide.addEventListener('change', onChange);
  return () => {
    wide.removeEventListener('change', onChange);
  };
};

const isWide = (): boolean => window.matchMedia(WIDE_QUERY).matches;

const wideOnTheServer = (): boolean => true;

export function useWide(): boolean {
  return useSyncExternalStore(subscribe, isWide, wideOnTheServer);
}
