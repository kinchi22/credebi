'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

export type PrototypeSwitcherProps = {
  readonly variants: readonly { readonly key: string; readonly name: string }[];
  readonly current: string;
};

export function PrototypeSwitcher({ variants, current }: PrototypeSwitcherProps): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const index = Math.max(0, variants.findIndex((v) => v.key === current));
  const go = (step: number): void => {
    const next = variants[(index + step + variants.length) % variants.length];
    if (next !== undefined) router.replace(`${pathname}?variant=${next.key}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable]')) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  });

  if (process.env.NODE_ENV === 'production') return null;
  const shown = variants[index];
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ground-dark px-4 py-2 text-body-sm text-text-on-dark shadow-lg">
      <button type="button" onClick={() => { go(-1); }} aria-label="previous variant">
        ←
      </button>
      <span>
        PROTOTYPE {shown?.key} ({shown?.name})
      </span>
      <button type="button" onClick={() => { go(1); }} aria-label="next variant">
        →
      </button>
    </div>
  );
}
