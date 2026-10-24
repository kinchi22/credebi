export type TopBarScroll = {
  readonly shown: boolean;
  readonly y: number;
};

export type PageScroll = {
  readonly y: number;
  readonly end: number;
  readonly barHeight: number;
};

export const TOP_BAR_AT_REST: TopBarScroll = { shown: true, y: 0 };

export const topBarFrom = (y: number): TopBarScroll => ({ shown: true, y });

export const topBarShown = (state: TopBarScroll): TopBarScroll => ({ ...state, shown: true });

export function topBarAfterScroll(state: TopBarScroll, { y, end, barHeight }: PageScroll): TopBarScroll {
  if (y < 0 || y > end) {
    return state;
  }
  const shown = y <= barHeight || y < state.y || (y === state.y && state.shown);
  return { shown, y };
}
