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
