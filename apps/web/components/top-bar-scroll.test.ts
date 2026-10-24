import { describe, expect, it } from 'vitest';
import {
  TOP_BAR_AT_REST,
  topBarAfterScroll,
  topBarFrom,
  topBarShown,
  type TopBarScroll,
} from './top-bar-scroll';

const END = 1000;

const BAR_HEIGHT = 56;

const hidden = (y: number): TopBarScroll => ({ shown: false, y });

const shown = (y: number): TopBarScroll => ({ shown: true, y });

const scrollTo = (state: TopBarScroll, y: number): TopBarScroll =>
  topBarAfterScroll(state, { y, end: END, barHeight: BAR_HEIGHT });

describe('topBarFrom', () => {
  it('starts shown at the top of the page', () => {
    expect(TOP_BAR_AT_REST).toEqual(shown(0));
  });

  it('starts shown wherever the page opens, and judges the next scroll from there', () => {
    expect(topBarFrom(500)).toEqual(shown(500));
    expect(scrollTo(topBarFrom(500), 490)).toEqual(shown(490));
    expect(scrollTo(topBarFrom(500), 510)).toEqual(hidden(510));
  });
});

describe('topBarShown', () => {
  it('shows a hidden Top bar where the page is, and keeps a shown one shown', () => {
    expect(topBarShown(hidden(400))).toEqual(shown(400));
    expect(topBarShown(shown(400))).toEqual(shown(400));
  });
});

describe('topBarAfterScroll', () => {
  it('shows the Top bar while the page is scrolled no more than its height, whichever way', () => {
    expect(scrollTo(shown(0), 56)).toEqual(shown(56));
    expect(scrollTo(hidden(300), 56)).toEqual(shown(56));
    expect(scrollTo(hidden(300), 0)).toEqual(shown(0));
    expect(scrollTo(shown(20), 40)).toEqual(shown(40));
  });

  it('takes the height from the Top bar it is given', () => {
    expect(topBarAfterScroll(hidden(300), { y: 80, end: END, barHeight: 80 })).toEqual(shown(80));
    expect(topBarAfterScroll(shown(80), { y: 81, end: END, barHeight: 80 })).toEqual(hidden(81));
  });

  it('hides the Top bar on any downward scroll past its height', () => {
    expect(scrollTo(shown(56), 57)).toEqual(hidden(57));
    expect(scrollTo(shown(400), 401)).toEqual(hidden(401));
    expect(scrollTo(hidden(400), 700)).toEqual(hidden(700));
  });

  it('shows the Top bar on any upward scroll, however short', () => {
    expect(scrollTo(hidden(400), 399)).toEqual(shown(399));
    expect(scrollTo(shown(400), 200)).toEqual(shown(200));
  });

  it('keeps the Top bar as it is when the scroll position has not moved', () => {
    expect(scrollTo(hidden(400), 400)).toEqual(hidden(400));
    expect(scrollTo(shown(400), 400)).toEqual(shown(400));
  });

  it('follows scroll positions up to and including the end of the page', () => {
    expect(scrollTo(shown(900), END)).toEqual(hidden(END));
    expect(scrollTo(hidden(END), END - 1)).toEqual(shown(END - 1));
  });

  it('ignores scroll positions past either end of the page, as the overscroll bounce reports them', () => {
    expect(scrollTo(hidden(END), END + 40)).toEqual(hidden(END));
    expect(scrollTo(shown(END - 1), END + 40)).toEqual(shown(END - 1));
    expect(scrollTo(hidden(END), END + 0.5)).toEqual(hidden(END));
    expect(scrollTo(shown(10), -30)).toEqual(shown(10));
    expect(scrollTo(hidden(300), -0.5)).toEqual(hidden(300));
  });
});
