import { readFileSync } from 'node:fs';
import { themeDeclarations } from '@repo/ui/tokens';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

const THEME_BLOCK = /@theme\s*\{([^}]*)\}/u;
const DECLARATION = /^\s*(--[\w-]+(?:-\*)?)\s*:\s*([^;]+?)\s*;\s*$/u;

const themeLines = (css: string): readonly string[] =>
  (THEME_BLOCK.exec(css)?.[1] ?? '').split('\n').filter((line) => line.trim() !== '');

const themeBlock = (css: string): Readonly<Record<string, string>> =>
  Object.fromEntries(
    themeLines(css).map((line): [string, string] => {
      const match = DECLARATION.exec(line);
      return [match?.[1] ?? line.trim(), match?.[2] ?? ''];
    }),
  );

const COLOUR_RESET = '--color-*';
const BREAKPOINT_RESET = '--breakpoint-*';

describe('the global stylesheet', () => {
  it('declares in @theme exactly the tokens the tokens module holds, after resetting the colours and the breakpoints', () => {
    const {
      [COLOUR_RESET]: colourReset,
      [BREAKPOINT_RESET]: breakpointReset,
      ...declarations
    } = themeBlock(stylesheet);
    expect(colourReset).toBe('initial');
    expect(breakpointReset).toBe('initial');
    expect(declarations).toEqual(themeDeclarations());
  });

  it('resets the colours and the breakpoints before declaring any token, so only token colours and token breakpoints exist', () => {
    expect(themeLines(stylesheet).slice(0, 2).map((line) => line.trim())).toEqual([
      `${COLOUR_RESET}: initial;`,
      `${BREAKPOINT_RESET}: initial;`,
    ]);
  });

  it('imports Tailwind', () => {
    expect(stylesheet).toMatch(/^@import "tailwindcss";$/mu);
  });
});
