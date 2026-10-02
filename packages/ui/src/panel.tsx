import { useId, type ReactNode } from 'react';
import { typeClasses } from './type-classes';

export const PANEL = 'rounded border border-border bg-surface p-2 wide:p-4';

export const PANEL_BLEED = '-mx-2 px-2 wide:-mx-4 wide:px-4';

export type PanelProps = {
  readonly title: string;
  readonly titleHidden?: boolean;
  readonly children: ReactNode;
};

export function Panel({ title, titleHidden = false, children }: PanelProps): ReactNode {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={PANEL}>
      <h2
        id={titleId}
        className={titleHidden ? 'sr-only' : `mb-2 ${typeClasses.label} text-text-muted`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
