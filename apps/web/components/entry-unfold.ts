import { type PostedEntry } from '@repo/contracts';
import { hasOneLinePerSide, type HeldOpen } from './entry-lines';

export const UNFOLD_SLACK = 24;

export const UNFOLD_MIN_SCROLL = 120;

const UNFOLD_AT_VIEWPORT = 0.5;

export const unfoldingIndex = (entries: readonly PostedEntry[]): number =>
  entries.findIndex((entry) => !hasOneLinePerSide(entry));

export function heldOpenAt(entries: readonly PostedEntry[], open: boolean): HeldOpen {
  const unfolding = entries[unfoldingIndex(entries)];
  return new Map(unfolding === undefined ? [] : [[unfolding.id, open]]);
}

export type UnfoldPlace = {
  readonly entryTop: number;
  readonly viewportHeight: number;
};

export const unfoldThreshold = ({ entryTop, viewportHeight }: UnfoldPlace): number =>
  Math.max(entryTop - viewportHeight * UNFOLD_AT_VIEWPORT, UNFOLD_MIN_SCROLL);

export type UnfoldScroll = {
  readonly y: number;
  readonly threshold: number;
};

export const unfoldedAfterScroll = (open: boolean, { y, threshold }: UnfoldScroll): boolean =>
  open ? y >= threshold - UNFOLD_SLACK : y > threshold + UNFOLD_SLACK;

export type Spot = {
  readonly x: number;
  readonly y: number;
};

export const spotWithin = (box: Spot, origin: Spot): Spot => ({ x: box.x - origin.x, y: box.y - origin.y });

export const shiftFrom = (was: Spot, is: Spot): string =>
  `translate(${String(was.x - is.x)}px, ${String(was.y - is.y)}px)`;

const MS_PER_SECOND = 1000;

export function millisecondsOf(duration: string): number {
  const value = duration.trim();
  if (value.endsWith('ms')) return Number.parseFloat(value);
  return value.endsWith('s') ? Number.parseFloat(value) * MS_PER_SECOND : 0;
}
