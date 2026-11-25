export const SWIPE_MIN_DISTANCE = 48;

export const SWIPE_MIN_RATIO = 1.5;

export const SWIPE_EDGE = 24;

export type SwipePoint = {
  readonly x: number;
  readonly y: number;
};

export type Swipe = {
  readonly start: SwipePoint;
  readonly end: SwipePoint;
  readonly screenWidth: number;
  readonly pointerType: string;
  readonly tabCount: number;
  readonly shownIndex: number;
};

export function swipeTarget(swipe: Swipe): number | undefined {
  const { start, end, screenWidth, pointerType, tabCount, shownIndex } = swipe;
  const across = Math.abs(end.x - start.x);
  const down = Math.abs(end.y - start.y);
  const switches =
    pointerType === 'touch' &&
    across >= SWIPE_MIN_DISTANCE &&
    across >= SWIPE_MIN_RATIO * down &&
    start.x > SWIPE_EDGE &&
    start.x < screenWidth - SWIPE_EDGE;
  if (!switches) {
    return undefined;
  }
  const target = shownIndex + (end.x < start.x ? 1 : -1);
  return target >= 0 && target < tabCount ? target : undefined;
}
