import { useId, type ReactNode } from 'react';
import { typeClasses } from './type-classes';

const PANEL_SURFACE = 'border border-border bg-surface';

export const PANEL_FRAME = `${PANEL_SURFACE} rounded-panel shadow-lift`;

export const PANEL = `${PANEL_FRAME} p-2 wide:p-4`;

export const SIGN_IN_CARD = `${PANEL_SURFACE} rounded-card shadow-lift-card`;

export const PANEL_TITLE = `${typeClasses.title} text-text`;

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
        className={titleHidden ? 'sr-only' : `mb-2 ${PANEL_TITLE}`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
