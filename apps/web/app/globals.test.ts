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
const RADIUS_RESET = '--radius-*';
const SHADOW_RESET = '--shadow-*';

describe('the global stylesheet', () => {
  it('declares in @theme exactly the tokens the tokens module holds, after resetting the colours, the breakpoints, the radii and the shadows', () => {
    const {
      [COLOUR_RESET]: colourReset,
      [BREAKPOINT_RESET]: breakpointReset,
      [RADIUS_RESET]: radiusReset,
      [SHADOW_RESET]: shadowReset,
      ...declarations
    } = themeBlock(stylesheet);
    expect([colourReset, breakpointReset, radiusReset, shadowReset]).toEqual([
      'initial',
      'initial',
      'initial',
      'initial',
    ]);
    expect(declarations).toEqual(themeDeclarations());
  });

  it('resets the colours, the breakpoints, the radii and the shadows before declaring any token, so only token ones exist', () => {
    expect(themeLines(stylesheet).slice(0, 4).map((line) => line.trim())).toEqual([
      `${COLOUR_RESET}: initial;`,
      `${BREAKPOINT_RESET}: initial;`,
      `${RADIUS_RESET}: initial;`,
      `${SHADOW_RESET}: initial;`,
    ]);
  });

  it('gives the pointer cursor to every enabled button, tab and choice, and to the label that wraps a choice', () => {
    const pointerRule = /([^{}]+)\{\s*cursor:\s*pointer;\s*\}/u.exec(stylesheet);
    const selectors = (pointerRule?.[1] ?? '').split(/,\s*(?![^()]*\))/u).map((selector) => selector.trim());
    expect(selectors).toEqual([
      'button:enabled',
      '[role="tab"]:not(:disabled, [aria-disabled="true"])',
      'input:is([type="radio"], [type="checkbox"]):enabled',
      'label:has(input:is([type="radio"], [type="checkbox"]):enabled)',
    ]);
  });

  it('imports Tailwind', () => {
    expect(stylesheet).toMatch(/^@import "tailwindcss";$/mu);
  });
});
