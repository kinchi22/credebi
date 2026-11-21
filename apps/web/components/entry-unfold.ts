export const UNFOLD_SLACK = 24;

export const UNFOLD_MIN_SCROLL = 120;

const UNFOLD_AT_VIEWPORT = 0.5;

export type UnfoldPlace = {
  readonly entryTop: number;
  readonly viewportHeight: number;
};

export const unfoldLine = ({ entryTop, viewportHeight }: UnfoldPlace): number =>
  Math.max(entryTop - viewportHeight * UNFOLD_AT_VIEWPORT, UNFOLD_MIN_SCROLL);

export const unfoldedAfterScroll = (open: boolean, y: number, line: number): boolean =>
  open ? y >= line - UNFOLD_SLACK : y > line + UNFOLD_SLACK;

export type Spot = {
  readonly x: number;
  readonly y: number;
};

export const spotWithin = (box: Spot, origin: Spot): Spot => ({ x: box.x - origin.x, y: box.y - origin.y });

export const shiftFrom = (was: Spot, is: Spot): string =>
  `translate(${String(was.x - is.x)}px, ${String(was.y - is.y)}px)`;
