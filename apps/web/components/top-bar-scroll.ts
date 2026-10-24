export const TOP_BAR_HEIGHT = 56;

export type TopBarScroll = {
  readonly shown: boolean;
  readonly y: number;
};

export const TOP_BAR_AT_REST: TopBarScroll = { shown: true, y: 0 };

export function topBarAfterScroll(state: TopBarScroll, y: number, end: number): TopBarScroll {
  if (y < 0 || y > end) {
    return state;
  }
  const shown = y <= TOP_BAR_HEIGHT || y < state.y || (y === state.y && state.shown);
  return { shown, y };
}
