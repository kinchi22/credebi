import { describe, expect, it } from 'vitest';
import { shiftFrom, spotWithin, UNFOLD_MIN_SCROLL, UNFOLD_SLACK, unfoldedAfterScroll, unfoldLine } from './entry-unfold';

describe('unfoldLine', () => {
  it('draws the line where the Entry reaches the middle of the viewport', () => {
    expect(unfoldLine({ entryTop: 1400, viewportHeight: 800 })).toBe(1000);
    expect(unfoldLine({ entryTop: 900, viewportHeight: 600 })).toBe(600);
  });

  it('keeps the line below the top of the page, so the Entry starts closed however high it sits', () => {
    expect(unfoldLine({ entryTop: 300, viewportHeight: 720 })).toBe(UNFOLD_MIN_SCROLL);
    expect(unfoldLine({ entryTop: 480, viewportHeight: 720 })).toBe(UNFOLD_MIN_SCROLL);
    expect(unfoldLine({ entryTop: 482, viewportHeight: 720 })).toBe(UNFOLD_MIN_SCROLL + 2);
  });
});

describe('unfoldedAfterScroll', () => {
  const LINE = 500;

  it('opens the Entry only once the page is scrolled further than the slack past the line', () => {
    expect(unfoldedAfterScroll(false, LINE, LINE)).toBe(false);
    expect(unfoldedAfterScroll(false, LINE + UNFOLD_SLACK, LINE)).toBe(false);
    expect(unfoldedAfterScroll(false, LINE + UNFOLD_SLACK + 1, LINE)).toBe(true);
    expect(unfoldedAfterScroll(false, 0, LINE)).toBe(false);
  });

  it('closes the Entry only once the page is scrolled back further than the slack above the line', () => {
    expect(unfoldedAfterScroll(true, LINE, LINE)).toBe(true);
    expect(unfoldedAfterScroll(true, LINE - UNFOLD_SLACK, LINE)).toBe(true);
    expect(unfoldedAfterScroll(true, LINE - UNFOLD_SLACK - 1, LINE)).toBe(false);
    expect(unfoldedAfterScroll(true, 3000, LINE)).toBe(true);
  });

  it('keeps the Entry as it is anywhere within the slack around the line, so it does not flicker there', () => {
    for (const y of [LINE - UNFOLD_SLACK, LINE - 1, LINE, LINE + 1, LINE + UNFOLD_SLACK]) {
      expect(unfoldedAfterScroll(false, y, LINE)).toBe(false);
      expect(unfoldedAfterScroll(true, y, LINE)).toBe(true);
    }
  });
});

describe('spotWithin', () => {
  it('places a box relative to the origin it is measured from', () => {
    expect(spotWithin({ x: 130, y: 260 }, { x: 100, y: 200 })).toEqual({ x: 30, y: 60 });
    expect(spotWithin({ x: 90, y: 180 }, { x: 100, y: 200 })).toEqual({ x: -10, y: -20 });
  });
});

describe('shiftFrom', () => {
  it('moves a box from where it is back to where it was', () => {
    expect(shiftFrom({ x: 0, y: 40 }, { x: 200, y: 10 })).toBe('translate(-200px, 30px)');
    expect(shiftFrom({ x: 12, y: 8 }, { x: 12, y: 8 })).toBe('translate(0px, 0px)');
  });
});
