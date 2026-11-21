import { readFileSync } from 'node:fs';
import { fontDeclarations, themeDeclarations } from '@repo/ui/tokens';
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

const ruleFor = (selector: string): Readonly<Record<string, string>> => {
  const rule = [...stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].find((match) =>
    (match[1] ?? '').split(',').some((each) => each.trim() === selector),
  );
  return Object.fromEntries(
    (rule?.[2] ?? '')
      .split(';')
      .map((declaration) => /^\s*([\w-]+)\s*:\s*(.+?)\s*$/u.exec(declaration))
      .filter((match) => match !== null)
      .map((match): [string, string] => [match[1] ?? '', match[2] ?? '']),
  );
};

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

  it('gives the pointer cursor to every enabled button, tab, option and choice, and to the label that wraps a choice', () => {
    const pointerRule = /([^{}]+)\{\s*cursor:\s*pointer;\s*\}/u.exec(stylesheet);
    const selectors = (pointerRule?.[1] ?? '').split(/,\s*(?![^()]*\))/u).map((selector) => selector.trim());
    expect(selectors).toEqual([
      'button:enabled',
      '[role="tab"]:not(:disabled, [aria-disabled="true"])',
      '[role="option"]:not([aria-disabled="true"])',
      'input:is([type="radio"], [type="checkbox"]):enabled',
      'label:has(input:is([type="radio"], [type="checkbox"]):enabled)',
    ]);
  });

  it('puts the Japanese system faces first on a page in Japanese, as the tokens module orders them', () => {
    const block = /:root:lang\(ja\)\s*\{([^}]*)\}/u.exec(stylesheet)?.[1] ?? '';
    const declarations = Object.fromEntries(
      block
        .split('\n')
        .map((line) => DECLARATION.exec(line))
        .filter((match) => match !== null)
        .map((match): [string, string] => [match[1] ?? '', match[2] ?? '']),
    );
    expect(declarations).toEqual(fontDeclarations('ja'));
  });

  it('breaks Korean copy only between words on a page in Korean, still breaking a run too long for its line', () => {
    const block = /:root:lang\(ko\)\s*\{([^}]*)\}/u.exec(stylesheet)?.[1] ?? '';
    const declarations = Object.fromEntries(
      block
        .split('\n')
        .map((line) => /^\s*([\w-]+)\s*:\s*([^;]+?)\s*;\s*$/u.exec(line))
        .filter((match) => match !== null)
        .map((match): [string, string] => [match[1] ?? '', match[2] ?? '']),
    );
    expect(declarations).toEqual({ 'word-break': 'keep-all', 'overflow-wrap': 'break-word' });
  });

  it('runs the whole Entry expansion, the page behind it included, over 200ms ease-out', () => {
    expect(ruleFor(':root')).toEqual({
      '--entry-expansion-duration': '200ms',
      '--entry-expansion-easing': 'ease-out',
    });
    expect(ruleFor('::view-transition-group(root)')).toEqual({
      'animation-duration': 'var(--entry-expansion-duration)',
      'animation-timing-function': 'var(--entry-expansion-easing)',
    });
    expect(ruleFor('::view-transition-group(.entry-expansion)')).toEqual(ruleFor('::view-transition-group(root)'));
    expect(ruleFor('::view-transition-group(.entry-expansion-line)')).toEqual(
      ruleFor('::view-transition-group(root)'),
    );
  });

  it('anchors every Entry and line snapshot of the Entry expansion at its top left, never stretched', () => {
    for (const snapshot of [
      '::view-transition-old(.entry-expansion)',
      '::view-transition-new(.entry-expansion)',
      '::view-transition-old(.entry-expansion-line)',
      '::view-transition-new(.entry-expansion-line)',
    ]) {
      expect(ruleFor(snapshot)).toEqual({
        height: '100%',
        width: '100%',
        'object-fit': 'none',
        'object-position': 'left top',
      });
    }
  });

  it('imports Tailwind', () => {
    expect(stylesheet).toMatch(/^@import "tailwindcss";$/mu);
  });
});
