import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

describe('contrastRatio', () => {
  it('gives black on white the maximum ratio of 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('gives a colour against itself the minimum ratio of 1', () => {
    expect(contrastRatio('#4A6461', '#4A6461')).toBe(1);
  });

  it('is the same whichever colour is the foreground', () => {
    expect(contrastRatio('#FFFFFF', '#0B7A5E')).toBe(contrastRatio('#0B7A5E', '#FFFFFF'));
  });

  it('weighs green above red above blue, as the eye does', () => {
    expect(contrastRatio('#00FF00', '#000000')).toBeCloseTo(15.3, 1);
    expect(contrastRatio('#FF0000', '#000000')).toBeCloseTo(5.25, 2);
    expect(contrastRatio('#0000FF', '#000000')).toBeCloseTo(2.44, 2);
  });

  it('treats a dark channel as linear below the sRGB knee', () => {
    expect(contrastRatio('#0A0A0A', '#000000')).toBeCloseTo(1.0607, 4);
  });

  it('applies the gamma curve to a mid-grey', () => {
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('reads hex digits in either case', () => {
    expect(contrastRatio('#0b7a5e', '#ffffff')).toBe(contrastRatio('#0B7A5E', '#FFFFFF'));
  });

  it('refuses a colour that is not six hex digits', () => {
    expect(() => contrastRatio('#FFF', '#000000')).toThrow('#FFF');
    expect(() => contrastRatio('#000000', 'white')).toThrow('white');
    expect(() => contrastRatio('#GGGGGG', '#000000')).toThrow('#GGGGGG');
    expect(() => contrastRatio('x#000000', '#000000')).toThrow('x#000000');
    expect(() => contrastRatio('#0000000', '#000000')).toThrow('#0000000');
  });
});
