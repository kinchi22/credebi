import { describe, expect, it } from 'vitest';
import { swipeTarget, type Swipe } from './sheet-swipe';

const swipe = (over: {
  readonly dx?: number;
  readonly dy?: number;
  readonly startX?: number;
  readonly pointerType?: string;
  readonly shownIndex?: number;
  readonly tabCount?: number;
}): Swipe => {
  const startX = over.startX ?? 200;
  return {
    start: { x: startX, y: 300 },
    end: { x: startX + (over.dx ?? -100), y: 300 + (over.dy ?? 0) },
    screenWidth: 400,
    pointerType: over.pointerType ?? 'touch',
    tabCount: over.tabCount ?? 2,
    shownIndex: over.shownIndex ?? 0,
  };
};

describe('swipeTarget', () => {
  it('shows the next tab after a swipe to the left', () => {
    expect(swipeTarget(swipe({ dx: -100, shownIndex: 0 }))).toBe(1);
  });

  it('shows the previous tab after a swipe to the right', () => {
    expect(swipeTarget(swipe({ dx: 100, shownIndex: 1 }))).toBe(0);
  });

  it('moves one tab among several', () => {
    expect(swipeTarget(swipe({ dx: -100, shownIndex: 1, tabCount: 4 }))).toBe(2);
    expect(swipeTarget(swipe({ dx: 100, shownIndex: 2, tabCount: 4 }))).toBe(1);
  });

  it('switches at exactly 48px and not at 47px', () => {
    expect(swipeTarget(swipe({ dx: -48 }))).toBe(1);
    expect(swipeTarget(swipe({ dx: -47 }))).toBeUndefined();
    expect(swipeTarget(swipe({ dx: 48, shownIndex: 1 }))).toBe(0);
    expect(swipeTarget(swipe({ dx: 47, shownIndex: 1 }))).toBeUndefined();
  });

  it('switches at exactly 1.5 times as far across as down and not below', () => {
    expect(swipeTarget(swipe({ dx: -90, dy: 60 }))).toBe(1);
    expect(swipeTarget(swipe({ dx: -89, dy: 60 }))).toBeUndefined();
    expect(swipeTarget(swipe({ dx: -90, dy: -60 }))).toBe(1);
  });

  it('ignores a start 24px from either edge and accepts one 25px from it', () => {
    expect(swipeTarget(swipe({ startX: 24, dx: 100, shownIndex: 1 }))).toBeUndefined();
    expect(swipeTarget(swipe({ startX: 25, dx: 100, shownIndex: 1 }))).toBe(0);
    expect(swipeTarget(swipe({ startX: 376, dx: -100 }))).toBeUndefined();
    expect(swipeTarget(swipe({ startX: 375, dx: -100 }))).toBe(1);
  });

  it('ignores a mouse and a pen', () => {
    expect(swipeTarget(swipe({ pointerType: 'mouse' }))).toBeUndefined();
    expect(swipeTarget(swipe({ pointerType: 'pen' }))).toBeUndefined();
  });

  it('does nothing past either end', () => {
    expect(swipeTarget(swipe({ dx: -100, shownIndex: 1 }))).toBeUndefined();
    expect(swipeTarget(swipe({ dx: 100, shownIndex: 0 }))).toBeUndefined();
    expect(swipeTarget(swipe({ dx: -100, shownIndex: 3, tabCount: 4 }))).toBeUndefined();
  });
});
