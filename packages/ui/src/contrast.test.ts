import { describe, expect, it } from 'vitest';
import { colorDifference, contrastRatio } from './contrast';

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

describe('colorDifference', () => {
  it('sets black and white 100 apart, the whole lightness scale', () => {
    expect(colorDifference('#000000', '#FFFFFF')).toBeCloseTo(100, 4);
  });

  it('sets a colour no distance from itself', () => {
    expect(colorDifference('#8A5A44', '#8A5A44')).toBe(0);
  });

  it('is the same whichever colour comes first', () => {
    expect(colorDifference('#B4400F', '#7F6500')).toBe(colorDifference('#7F6500', '#B4400F'));
  });

  it('measures each primary from black by its lightness and both hue axes', () => {
    expect(colorDifference('#FF0000', '#000000')).toBeCloseTo(117.34, 2);
    expect(colorDifference('#00FF00', '#000000')).toBeCloseTo(148.47, 2);
    expect(colorDifference('#0000FF', '#000000')).toBeCloseTo(137.66, 2);
  });

  it('measures a grey by lightness alone, on the cube-root curve above the knee', () => {
    expect(colorDifference('#777777', '#FFFFFF')).toBeCloseTo(49.97, 2);
    expect(colorDifference('#808080', '#000000')).toBeCloseTo(53.59, 2);
  });

  it('measures a near-black on the linear segment below the knee', () => {
    expect(colorDifference('#0A0A0A', '#000000')).toBeCloseTo(2.742, 3);
    expect(colorDifference('#010101', '#000000')).toBeCloseTo(0.2742, 4);
  });

  it('keeps the dark gold of Credit apart from the ochre of warning and the rust of danger', () => {
    expect(colorDifference('#7F6500', '#A15C00')).toBeCloseTo(21.47, 2);
    expect(colorDifference('#7F6500', '#B4400F')).toBeCloseTo(43.38, 2);
  });

  it('reads hex digits in either case', () => {
    expect(colorDifference('#8a5a44', '#ffffff')).toBe(colorDifference('#8A5A44', '#FFFFFF'));
  });

  it('refuses a colour that is not six hex digits', () => {
    expect(() => colorDifference('#FFF', '#000000')).toThrow('#FFF');
    expect(() => colorDifference('#000000', 'white')).toThrow('white');
  });
});
