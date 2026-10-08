'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

export function PrototypeSwitcher({
  variants,
  current,
}: {
  readonly variants: readonly { readonly key: string; readonly name: string }[];
  readonly current: string;
}): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );
  const go = (step: number): void => {
    const next = variants[(index + step + variants.length) % variants.length];
    if (next) router.replace(`${pathname}?variant=${next.key}`, { scroll: false });
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (process.env.NODE_ENV === 'production') return null;
  const shown = variants[index];
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded bg-ground-dark px-4 py-2 text-text-on-dark shadow-lg">
      <button type="button" onClick={() => go(-1)}>
        ←
      </button>
      <span>
        {shown?.key} ({shown?.name})
      </span>
      <button type="button" onClick={() => go(1)}>
        →
      </button>
    </div>
  );
}
