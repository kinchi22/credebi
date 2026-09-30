import { describe, expect, it } from 'vitest';
import {
  CLEAR_SPACE,
  drawLogo,
  LOCKUP_GAP,
  logoTones,
  logoVariants,
  type LogoBox,
  type LogoDrawing,
  type LogoPart,
  type LogoTone,
  type LogoVariant,
} from './logo-drawing';
import { CAP_HEIGHT, glyphs, UNITS_PER_EM, WORDMARK } from './wordmark';

const every = logoVariants.flatMap((variant) =>
  logoTones.map((tone) => [variant, tone] as const),
);

const union = (boxes: readonly LogoBox[]): LogoBox => ({
  minX: Math.min(...boxes.map((box) => box.minX)),
  minY: Math.min(...boxes.map((box) => box.minY)),
  maxX: Math.max(...boxes.map((box) => box.maxX)),
  maxY: Math.max(...boxes.map((box) => box.maxY)),
});

const halves = (parts: readonly LogoPart[]): readonly LogoPart[] =>
  parts.filter((part) => part.name === 'left-half' || part.name === 'right-half');

const letters = (parts: readonly LogoPart[]): readonly LogoPart[] =>
  parts.filter((part) => part.name !== 'left-half' && part.name !== 'right-half');

const part = (parts: readonly LogoPart[], name: LogoPart['name']): LogoPart => {
  const found = parts.find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Error(`the logo has no ${name}`);
  }
  return found;
};

const centre = (box: LogoBox): { readonly x: number; readonly y: number } => ({
  x: (box.minX + box.maxX) / 2,
  y: (box.minY + box.maxY) / 2,
});

type Lockup = {
  readonly parts: readonly LogoPart[];
  readonly mark: LogoBox;
  readonly wordmark: LogoBox;
};

const layOut = ({ parts }: LogoDrawing): Lockup => ({
  parts,
  mark: union(halves(parts).map((each) => each.bounds)),
  wordmark: union(letters(parts).map((each) => each.bounds)),
});

const expectedFills: Readonly<Record<LogoTone, readonly string[]>> = {
  color: [
    'left-half:text',
    'right-half:accent',
    'C:accent-text',
    'r:text',
    'e:text',
    'd:accent-text',
    'e:text',
    'b:text',
    'i:text',
  ],
  reverse: [
    'left-half:text-on-dark',
    'right-half:accent',
    'C:accent',
    'r:text-on-dark',
    'e:text-on-dark',
    'd:accent',
    'e:text-on-dark',
    'b:text-on-dark',
    'i:text-on-dark',
  ],
  mono: [
    'left-half:text',
    'right-half:text',
    'C:text',
    'r:text',
    'e:text',
    'd:text',
    'e:text',
    'b:text',
    'i:text',
  ],
};

const fillsOf = (variant: LogoVariant, tone: LogoTone): readonly string[] =>
  drawLogo(variant, tone).parts.map((each) => `${each.name}:${each.fill}`);

describe('the Mark', () => {
  const drawMark = (): LogoDrawing => drawLogo('mark', 'color');

  it('is the two halves of the coin and no lettering', () => {
    expect(drawMark().parts.map((each) => each.name)).toEqual(['left-half', 'right-half']);
  });

  it('draws each half as a closed outline at its own size', () => {
    for (const each of drawMark().parts) {
      expect(each.d).toMatch(/^M.*Z$/);
      expect(each.x).toBe(0);
      expect(each.y).toBe(0);
      expect(each.scale).toBe(1);
    }
  });

  it('stands the halves apart, the left lower and the right higher', () => {
    const { parts } = drawMark();
    const left = part(parts, 'left-half').bounds;
    const right = part(parts, 'right-half').bounds;

    expect(right.minX - left.maxX).toBe(8);
    expect(left.minY - right.minY).toBe(12);
    expect(left.maxY - right.maxY).toBe(12);
    expect(left.maxY - left.minY).toBe(right.maxY - right.minY);
  });

  it('takes the thickness of the C ring, about a fifth of its height, as the clear space', () => {
    const height = union(drawMark().parts.map((each) => each.bounds));

    expect(CLEAR_SPACE).toBe(22);
    expect(CLEAR_SPACE / (height.maxY - height.minY)).toBeCloseTo(0.2, 1);
  });
});

describe('every variant and tone', () => {
  it.each(every)('%s in %s keeps the clear space on every side', (variant, tone) => {
    const { viewBox, parts } = drawLogo(variant, tone);
    const ink = union(parts.map((each) => each.bounds));

    expect(viewBox).toEqual({
      minX: ink.minX - CLEAR_SPACE,
      minY: ink.minY - CLEAR_SPACE,
      maxX: ink.maxX + CLEAR_SPACE,
      maxY: ink.maxY + CLEAR_SPACE,
    });
  });

  it.each(every)('%s in %s draws the same Mark', (variant, tone) => {
    expect(halves(drawLogo(variant, tone).parts)).toEqual(
      halves(drawLogo('mark', tone).parts),
    );
  });
});

describe('the Wordmark', () => {
  it.each(['horizontal', 'stacked'] as const)('%s spells Credebi in outlined letters', (variant) => {
    const wordmark = letters(drawLogo(variant, 'color').parts);

    expect(wordmark.map((each) => each.name).join('')).toBe('Credebi');
    for (const each of wordmark) {
      expect(each.d).toBe(glyphs[each.name as keyof typeof glyphs].d);
    }
  });

  it.each(WORDMARK)('bounds %s by the extremes of its outline', (letter) => {
    const numbers = (glyphs[letter].d.match(/-?\d+/g) ?? []).map(Number);
    const xs = numbers.filter((_, index) => index % 2 === 0);
    const ys = numbers.filter((_, index) => index % 2 === 1);

    expect(glyphs[letter].bounds).toEqual({
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    });
  });

  it('commits every letter as a closed outline', () => {
    for (const letter of WORDMARK) {
      expect(glyphs[letter].d).toMatch(/^M.*Z$/);
    }
  });

  it.each(['horizontal', 'stacked'] as const)(
    '%s sets the letters in order, 0.02em tighter than their advance',
    (variant) => {
      const wordmark = letters(drawLogo(variant, 'color').parts);

      wordmark.slice(1).forEach((each, index) => {
        const previous = wordmark[index];
        if (previous === undefined) {
          throw new Error('no previous letter');
        }
        const advance = glyphs[previous.name as keyof typeof glyphs].advance;
        expect(each.x - previous.x).toBeCloseTo((advance - 0.02 * UNITS_PER_EM) * each.scale, 9);
        expect(each.y).toBe(previous.y);
        expect(each.scale).toBe(previous.scale);
      });
    },
  );

  it('places each letter where its outline is drawn', () => {
    for (const each of letters(drawLogo('horizontal', 'color').parts)) {
      const glyph = glyphs[each.name as keyof typeof glyphs];
      expect(each.bounds).toEqual({
        minX: each.x + glyph.bounds.minX * each.scale,
        minY: each.y + glyph.bounds.minY * each.scale,
        maxX: each.x + glyph.bounds.maxX * each.scale,
        maxY: each.y + glyph.bounds.maxY * each.scale,
      });
    }
  });
});

describe('the horizontal Lockup', () => {
  const lockup = (): Lockup => layOut(drawLogo('horizontal', 'color'));

  it('sets the Wordmark 1.5x right of the Mark', () => {
    const { mark, wordmark } = lockup();

    expect(LOCKUP_GAP).toBe(1.5 * CLEAR_SPACE);
    expect(wordmark.minX - mark.maxX).toBeCloseTo(LOCKUP_GAP, 9);
  });

  it('centres the Wordmark cap height on the Mark', () => {
    const { parts, mark } = lockup();

    const baseline = part(parts, 'r').bounds.maxY;
    const capTop = part(parts, 'd').bounds.minY;

    expect(baseline - capTop).toBeCloseTo(CAP_HEIGHT * part(parts, 'd').scale, 9);
    expect((baseline + capTop) / 2).toBeCloseTo(centre(mark).y, 9);
  });

  it('sets the Wordmark 90 units to the em, its capitals about 0.6 of the Mark height', () => {
    const { parts, mark } = lockup();

    expect(part(parts, 'C').scale * UNITS_PER_EM).toBeCloseTo(90, 9);
    expect((CAP_HEIGHT * part(parts, 'C').scale) / (mark.maxY - mark.minY)).toBeCloseTo(0.6, 1);
  });
});

describe('the stacked Lockup', () => {
  const lockup = (): Lockup => layOut(drawLogo('stacked', 'color'));

  it('sets the Wordmark 1.5x below the Mark', () => {
    const { mark, wordmark } = lockup();

    expect(wordmark.minY - mark.maxY).toBeCloseTo(LOCKUP_GAP, 9);
  });

  it('centres the Wordmark under the Mark', () => {
    const { mark, wordmark } = lockup();

    expect(centre(wordmark).x).toBeCloseTo(centre(mark).x, 9);
  });

  it('sets the Wordmark 55 units to the em, smaller than in the horizontal Lockup', () => {
    const { parts } = lockup();

    expect(part(parts, 'C').scale * UNITS_PER_EM).toBeCloseTo(55, 9);
  });
});

describe('the tones', () => {
  it.each(every)('colours %s in %s by the tone, with C and d in its accent', (variant, tone) => {
    const expected = expectedFills[tone].slice(0, variant === 'mark' ? 2 : undefined);

    expect(fillsOf(variant, tone)).toEqual(expected);
  });

  it.each(logoVariants)('colours %s in the mono tone one colour throughout', (variant) => {
    expect(new Set(drawLogo(variant, 'mono').parts.map((each) => each.fill))).toEqual(
      new Set(['text']),
    );
  });

  it.each(logoVariants)('keeps the geometry of %s the same in every tone', (variant) => {
    const geometry = (tone: LogoTone): readonly unknown[] =>
      drawLogo(variant, tone).parts.map(({ fill: _fill, ...rest }) => rest);

    expect(geometry('reverse')).toEqual(geometry('color'));
    expect(geometry('mono')).toEqual(geometry('color'));
  });

  it('offers mark, horizontal and stacked in color, reverse and mono', () => {
    expect(logoVariants).toEqual(['mark', 'horizontal', 'stacked']);
    expect(logoTones).toEqual(['color', 'reverse', 'mono']);
  });
});
