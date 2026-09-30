import { useId, type ReactNode } from 'react';
import { typeClasses } from './type-classes';

export type PanelProps = {
  readonly title: string;
  readonly children: ReactNode;
};

export function Panel({ title, children }: PanelProps): ReactNode {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="rounded-lg border border-border bg-surface p-4">
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
