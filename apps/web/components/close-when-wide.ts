import { breakpoints } from '@repo/ui/tokens';
import { type RefObject, useEffect } from 'react';

const WIDE_QUERY = `(min-width: ${String(breakpoints.wide)}px)`;

export function useCloseWhenWide(dialog: RefObject<HTMLDialogElement | null>): void {
  useEffect(() => {
    const wide = window.matchMedia(WIDE_QUERY);
    const closeWhenWide = (): void => {
      if (wide.matches) dialog.current?.close();
    };
    wide.addEventListener('change', closeWhenWide);
    return () => {
      wide.removeEventListener('change', closeWhenWide);
    };
  }, [dialog]);
}
