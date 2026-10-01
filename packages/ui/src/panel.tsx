import { useId, type ReactNode } from 'react';
import { typeClasses } from './type-classes';

export const PANEL = 'rounded-lg border border-border bg-surface p-4';

export const PANEL_BLEED = '-mx-4 px-4';

export type PanelProps = {
  readonly title: string;
  readonly children: ReactNode;
};

export function Panel({ title, children }: PanelProps): ReactNode {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={PANEL}>
      <h2
        id={titleId}
        className={`mb-2 ${typeClasses.label} text-text-muted`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
