import { describe, expect, it } from 'vitest';
import { BROWSER_FOCUS_RETURN, focusAfterClick } from './focus-after-click';

describe('focusAfterClick', () => {
  it('returns focus afresh without a focus ring after a click made with a pointer', () => {
    expect(focusAfterClick(1)).toStrictEqual({ options: { focusVisible: false }, afresh: true });
  });

  it('returns focus afresh without a focus ring after a double click', () => {
    expect(focusAfterClick(2)).toStrictEqual({ options: { focusVisible: false }, afresh: true });
  });

  it('leaves the focus ring to the browser after a click made from the keyboard', () => {
    expect(focusAfterClick(0)).toStrictEqual({ options: {}, afresh: false });
  });

  it('returns focus the way the browser would when no click closed the dialog', () => {
    expect(BROWSER_FOCUS_RETURN).toStrictEqual({ options: {}, afresh: false });
  });
});
