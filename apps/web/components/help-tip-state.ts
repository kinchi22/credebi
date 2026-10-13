export type HelpTipState = 'closed' | 'hovered' | 'pinned';

export type HelpTipEvent = 'enter' | 'leave' | 'toggle' | 'dismiss';

export function helpTipAfter(state: HelpTipState, event: HelpTipEvent): HelpTipState {
  switch (event) {
    case 'enter':
      return state === 'closed' ? 'hovered' : state;
    case 'leave':
      return state === 'hovered' ? 'closed' : state;
    case 'toggle':
      return state === 'pinned' ? 'closed' : 'pinned';
    case 'dismiss':
      return 'closed';
  }
}

export const isHelpTipOpen = (state: HelpTipState): boolean => state !== 'closed';

const HELP_TIP_GUTTER = 24;

export type PanelPlace = {
  readonly left: number;
  readonly width: number;
};

export function helpTipShift({ left, width }: PanelPlace, viewportWidth: number): number {
  const overflow = left + width - (viewportWidth - HELP_TIP_GUTTER);
  const shift = Math.min(overflow, Math.max(0, left - HELP_TIP_GUTTER));
  return shift > 0 ? -shift : 0;
}

export const helpTipMaxWidth = (viewportWidth: number): number =>
  viewportWidth - 2 * HELP_TIP_GUTTER;
