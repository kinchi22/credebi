import { describe, expect, it } from 'vitest';
import { TOP_BAR_AT_REST, TOP_BAR_HEIGHT, topBarAfterScroll, type TopBarScroll } from './top-bar-scroll';

const END = 1000;

const hidden = (y: number): TopBarScroll => ({ shown: false, y });

const shown = (y: number): TopBarScroll => ({ shown: true, y });

describe('topBarAfterScroll', () => {
  it('starts shown at the top of the page', () => {
    expect(TOP_BAR_AT_REST).toEqual(shown(0));
    expect(TOP_BAR_HEIGHT).toBe(56);
  });

  it('shows the Top bar while the page is scrolled no more than its height, whichever way', () => {
    expect(topBarAfterScroll(shown(0), 56, END)).toEqual(shown(56));
    expect(topBarAfterScroll(hidden(300), 56, END)).toEqual(shown(56));
    expect(topBarAfterScroll(hidden(300), 0, END)).toEqual(shown(0));
    expect(topBarAfterScroll(shown(20), 40, END)).toEqual(shown(40));
  });

  it('hides the Top bar on any downward scroll past its height', () => {
    expect(topBarAfterScroll(shown(56), 57, END)).toEqual(hidden(57));
    expect(topBarAfterScroll(shown(400), 401, END)).toEqual(hidden(401));
    expect(topBarAfterScroll(hidden(400), 700, END)).toEqual(hidden(700));
  });

  it('shows the Top bar on any upward scroll, however short', () => {
    expect(topBarAfterScroll(hidden(400), 399, END)).toEqual(shown(399));
    expect(topBarAfterScroll(shown(400), 200, END)).toEqual(shown(200));
  });

  it('keeps the Top bar as it is when the scroll position has not moved', () => {
    expect(topBarAfterScroll(hidden(400), 400, END)).toEqual(hidden(400));
    expect(topBarAfterScroll(shown(400), 400, END)).toEqual(shown(400));
  });

  it('follows scroll positions up to and including the end of the page', () => {
    expect(topBarAfterScroll(shown(900), END, END)).toEqual(hidden(END));
    expect(topBarAfterScroll(hidden(END), END - 1, END)).toEqual(shown(END - 1));
  });

  it('ignores scroll positions past either end of the page, as the overscroll bounce reports them', () => {
    expect(topBarAfterScroll(hidden(END), END + 40, END)).toEqual(hidden(END));
    expect(topBarAfterScroll(shown(END - 1), END + 40, END)).toEqual(shown(END - 1));
    expect(topBarAfterScroll(hidden(END), END + 0.5, END)).toEqual(hidden(END));
    expect(topBarAfterScroll(shown(10), -30, END)).toEqual(shown(10));
    expect(topBarAfterScroll(hidden(300), -0.5, END)).toEqual(hidden(300));
  });
});
