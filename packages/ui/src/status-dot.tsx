import { type ReactNode } from 'react';

export type StatusTone = 'positive' | 'negative';

export type StatusDotProps = {
  readonly tone: StatusTone;
  readonly label: string;
};

export function StatusDot({ tone, label }: StatusDotProps): ReactNode {
  const toneClass = tone === 'positive' ? 'bg-positive' : 'bg-warning';

  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${toneClass}`} />
      <span>{label}</span>
    </span>
  );
}
