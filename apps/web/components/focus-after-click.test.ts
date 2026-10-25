import { describe, expect, it } from 'vitest';
import { focusAfterClick } from './focus-after-click';

describe('focusAfterClick', () => {
  it('returns focus without a focus ring after a click made with a pointer', () => {
    expect(focusAfterClick(1)).toStrictEqual({ focusVisible: false });
  });

  it('returns focus without a focus ring after a double click', () => {
    expect(focusAfterClick(2)).toStrictEqual({ focusVisible: false });
  });

  it('leaves the focus ring to the browser after a click made from the keyboard', () => {
    expect(focusAfterClick(0)).toStrictEqual({});
  });
});
