import { describe, expect, it } from 'vitest';
import { sampleBooks } from './sample-books';
import {
  heldOpenAt,
  millisecondsOf,
  shiftFrom,
  spotWithin,
  UNFOLD_MIN_SCROLL,
  UNFOLD_SLACK,
  unfoldedAfterScroll,
  unfoldingIndex,
  unfoldThreshold,
} from './entry-unfold';

const { entries } = sampleBooks({ name: (node) => node, title: (title) => title });

const scrolledTo = (open: boolean, y: number, threshold: number): boolean =>
  unfoldedAfterScroll(open, { y, threshold });

describe('unfoldingIndex', () => {
  it('picks the first Entry with more than one line on a Side', () => {
    expect(unfoldingIndex(entries)).toBe(1);
    expect(unfoldingIndex(entries.slice(2))).toBe(0);
    expect(unfoldingIndex([entries[0], entries[3], entries[2]].flatMap((entry) => entry ?? []))).toBe(2);
  });

  it('finds none among Entries of one line per Side', () => {
    expect(unfoldingIndex([entries[0], entries[3]].flatMap((entry) => entry ?? []))).toBe(-1);
  });
});

describe('heldOpenAt', () => {
  it('holds only the unfolding Entry, open or closed as asked', () => {
    const unfolding = entries[1]?.id;
    expect([...heldOpenAt(entries, true)]).toEqual([[unfolding, true]]);
    expect([...heldOpenAt(entries, false)]).toEqual([[unfolding, false]]);
  });

  it('holds nothing when no Entry unfolds', () => {
    expect(heldOpenAt(entries.slice(3), true).size).toBe(0);
  });
});

describe('unfoldThreshold', () => {
  it('draws the threshold where the Entry reaches the middle of the viewport', () => {
    expect(unfoldThreshold({ entryTop: 1400, viewportHeight: 800 })).toBe(1000);
    expect(unfoldThreshold({ entryTop: 900, viewportHeight: 600 })).toBe(600);
  });

  it('keeps the threshold below the top of the page, so the Entry starts closed however high it sits', () => {
    expect(unfoldThreshold({ entryTop: 300, viewportHeight: 720 })).toBe(UNFOLD_MIN_SCROLL);
    expect(unfoldThreshold({ entryTop: 480, viewportHeight: 720 })).toBe(UNFOLD_MIN_SCROLL);
    expect(unfoldThreshold({ entryTop: 482, viewportHeight: 720 })).toBe(UNFOLD_MIN_SCROLL + 2);
  });
});

describe('unfoldedAfterScroll', () => {
  const THRESHOLD = 500;

  it('opens the Entry only once the page is scrolled further than the slack past the threshold', () => {
    expect(scrolledTo(false, THRESHOLD, THRESHOLD)).toBe(false);
    expect(scrolledTo(false, THRESHOLD + UNFOLD_SLACK, THRESHOLD)).toBe(false);
    expect(scrolledTo(false, THRESHOLD + UNFOLD_SLACK + 1, THRESHOLD)).toBe(true);
    expect(scrolledTo(false, 0, THRESHOLD)).toBe(false);
  });

  it('closes the Entry only once the page is scrolled back further than the slack above the threshold', () => {
    expect(scrolledTo(true, THRESHOLD, THRESHOLD)).toBe(true);
    expect(scrolledTo(true, THRESHOLD - UNFOLD_SLACK, THRESHOLD)).toBe(true);
    expect(scrolledTo(true, THRESHOLD - UNFOLD_SLACK - 1, THRESHOLD)).toBe(false);
    expect(scrolledTo(true, 3000, THRESHOLD)).toBe(true);
  });

  it('keeps the Entry as it is anywhere within the slack around the threshold, so it does not flicker there', () => {
    for (const y of [THRESHOLD - UNFOLD_SLACK, THRESHOLD - 1, THRESHOLD, THRESHOLD + 1, THRESHOLD + UNFOLD_SLACK]) {
      expect(scrolledTo(false, y, THRESHOLD)).toBe(false);
      expect(scrolledTo(true, y, THRESHOLD)).toBe(true);
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

describe('millisecondsOf', () => {
  it('reads a CSS duration in milliseconds or seconds, as a minifier may rewrite it', () => {
    expect(millisecondsOf('200ms')).toBe(200);
    expect(millisecondsOf('.2s')).toBe(200);
    expect(millisecondsOf(' 0.25s ')).toBe(250);
    expect(millisecondsOf(' 180ms')).toBe(180);
  });

  it('reads anything else as no duration, so the change is instant', () => {
    expect(millisecondsOf('')).toBe(0);
    expect(millisecondsOf('200')).toBe(0);
  });
});
