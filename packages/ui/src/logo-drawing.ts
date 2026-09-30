import { type SemanticColor } from './tokens';
import {
  CAP_HEIGHT,
  glyphs,
  type LogoBox,
  TRACKING,
  UNITS_PER_EM,
  WORDMARK,
  type WordmarkLetter,
} from './wordmark';

export type { LogoBox } from './wordmark';

export const logoVariants = ['mark', 'horizontal', 'stacked'] as const;

export type LogoVariant = (typeof logoVariants)[number];

export const logoTones = ['color', 'reverse', 'mono'] as const;

export type LogoTone = (typeof logoTones)[number];

export type LogoPartName = 'left-half' | 'right-half' | WordmarkLetter;

export type LogoPart = {
  readonly name: LogoPartName;
  readonly d: string;
  readonly fill: SemanticColor;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly bounds: LogoBox;
};

export type LogoDrawing = {
  readonly viewBox: LogoBox;
  readonly parts: readonly LogoPart[];
};

export const CLEAR_SPACE = 22;

export const LOCKUP_GAP = 1.5 * CLEAR_SPACE;

type Half = {
  readonly name: 'left-half' | 'right-half';
  readonly d: string;
  readonly bounds: LogoBox;
};

const LEFT_HALF: Half = {
  name: 'left-half',
  d: 'M56 18A48 48 0 0 0 56 114L56 92A26 26 0 0 1 56 40Z',
  bounds: { minX: 8, minY: 18, maxX: 56, maxY: 114 },
};

const RIGHT_HALF: Half = {
  name: 'right-half',
  d: 'M64 6A48 48 0 0 1 64 102Z',
  bounds: { minX: 64, minY: 6, maxX: 112, maxY: 102 },
};

const union = (boxes: readonly LogoBox[]): LogoBox => ({
  minX: Math.min(...boxes.map((box) => box.minX)),
  minY: Math.min(...boxes.map((box) => box.minY)),
  maxX: Math.max(...boxes.map((box) => box.maxX)),
  maxY: Math.max(...boxes.map((box) => box.maxY)),
});

const markBounds = (): LogoBox => union([LEFT_HALF.bounds, RIGHT_HALF.bounds]);

const WORDMARK_SIZE = { horizontal: 90, stacked: 55 } as const;

const ACCENT_LETTERS: ReadonlySet<WordmarkLetter> = new Set(['C', 'd']);

type ToneFills = {
  readonly left: SemanticColor;
  readonly right: SemanticColor;
  readonly letter: SemanticColor;
  readonly accent: SemanticColor;
};

const toneFills: Readonly<Record<LogoTone, ToneFills>> = {
  color: { left: 'text', right: 'accent', letter: 'text', accent: 'accent-text' },
  reverse: { left: 'text-on-dark', right: 'accent', letter: 'text-on-dark', accent: 'accent' },
  mono: { left: 'text', right: 'text', letter: 'text', accent: 'text' },
};

const markParts = (fills: ToneFills): readonly LogoPart[] =>
  [
    { half: LEFT_HALF, fill: fills.left },
    { half: RIGHT_HALF, fill: fills.right },
  ].map(({ half, fill }) => ({ ...half, fill, x: 0, y: 0, scale: 1 }));

type Letter = { readonly name: WordmarkLetter; readonly pen: number };

const setLetters = (): readonly Letter[] =>
  WORDMARK.reduce<{ readonly letters: readonly Letter[]; readonly pen: number }>(
    ({ letters, pen }, name) => ({
      letters: [...letters, { name, pen }],
      pen: pen + glyphs[name].advance + TRACKING,
    }),
    { letters: [], pen: 0 },
  ).letters;

const letterBounds = (letter: Letter): LogoBox => {
  const { bounds } = glyphs[letter.name];
  return {
    minX: letter.pen + bounds.minX,
    minY: bounds.minY,
    maxX: letter.pen + bounds.maxX,
    maxY: bounds.maxY,
  };
};

function wordmarkOrigin(
  variant: 'horizontal' | 'stacked',
  ink: LogoBox,
  scale: number,
): { readonly x: number; readonly y: number } {
  const mark = markBounds();
  if (variant === 'horizontal') {
    return {
      x: mark.maxX + LOCKUP_GAP - ink.minX * scale,
      y: (mark.minY + mark.maxY) / 2 + (CAP_HEIGHT * scale) / 2,
    };
  }
  return {
    x: (mark.minX + mark.maxX) / 2 - ((ink.minX + ink.maxX) / 2) * scale,
    y: mark.maxY + LOCKUP_GAP - ink.minY * scale,
  };
}

function wordmarkParts(variant: 'horizontal' | 'stacked', fills: ToneFills): readonly LogoPart[] {
  const scale = WORDMARK_SIZE[variant] / UNITS_PER_EM;
  const letters = setLetters();
  const origin = wordmarkOrigin(variant, union(letters.map(letterBounds)), scale);

  return letters.map((letter) => {
    const x = origin.x + letter.pen * scale;
    const { bounds, d } = glyphs[letter.name];
    return {
      name: letter.name,
      d,
      fill: ACCENT_LETTERS.has(letter.name) ? fills.accent : fills.letter,
      x,
      y: origin.y,
      scale,
      bounds: {
        minX: x + bounds.minX * scale,
        minY: origin.y + bounds.minY * scale,
        maxX: x + bounds.maxX * scale,
        maxY: origin.y + bounds.maxY * scale,
      },
    };
  });
}

export function drawLogo(variant: LogoVariant, tone: LogoTone): LogoDrawing {
  const fills = toneFills[tone];
  const parts = [
    ...markParts(fills),
    ...(variant === 'mark' ? [] : wordmarkParts(variant, fills)),
  ];
  const ink = union(parts.map((part) => part.bounds));

  return {
    viewBox: {
      minX: ink.minX - CLEAR_SPACE,
      minY: ink.minY - CLEAR_SPACE,
      maxX: ink.maxX + CLEAR_SPACE,
      maxY: ink.maxY + CLEAR_SPACE,
    },
    parts,
  };
}
