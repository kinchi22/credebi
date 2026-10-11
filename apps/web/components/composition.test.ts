import { describe, expect, it } from 'vitest';
import { duringComposition } from './composition';

const key = (name: string, keyCode: number, isComposing = false) => ({
  key: name,
  keyCode,
  isComposing,
});

describe('duringComposition', () => {
  it('holds Enter and Escape pressed while a composition is open', () => {
    expect(duringComposition(key('Enter', 13, true), false)).toBe('hold');
    expect(duringComposition(key('Escape', 27, true), false)).toBe('hold');
    expect(duringComposition(key('Escape', 27), true)).toBe('hold');
  });

  it("holds Safari's Enter that follows compositionend, known only by keyCode 229", () => {
    expect(duringComposition(key('Enter', 229), false)).toBe('hold');
  });

  it('lets any other key pressed while composing reach the input method alone', () => {
    expect(duringComposition(key('ArrowDown', 40, true), false)).toBe('ignore');
    expect(duringComposition(key('a', 229), false)).toBe('ignore');
  });

  it('leaves every key to the combobox when nothing is being composed', () => {
    expect(duringComposition(key('Enter', 13), false)).toBe('none');
    expect(duringComposition(key('Escape', 27), false)).toBe('none');
    expect(duringComposition(key('ArrowDown', 40), false)).toBe('none');
  });
});
