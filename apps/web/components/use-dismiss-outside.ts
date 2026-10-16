import { useEffect, type RefObject } from 'react';

export function useDismissOutside(
  open: boolean,
  root: RefObject<HTMLElement | null>,
  dismiss: () => void,
): void {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const dismissOutside = (event: PointerEvent): void => {
      if (event.target instanceof Node && root.current?.contains(event.target) !== true) {
        dismiss();
      }
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
    };
  }, [open, root, dismiss]);
}
