import { readFileSync } from 'node:fs';
import { themeDeclarations } from '@repo/ui/tokens';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

const THEME_BLOCK = /@theme\s*\{([^}]*)\}/u;
const DECLARATION = /^\s*(--[\w-]+(?:-\*)?)\s*:\s*([^;]+?)\s*;\s*$/u;

const themeBlock = (css: string): Readonly<Record<string, string>> => {
  const body = THEME_BLOCK.exec(css)?.[1] ?? '';
  return Object.fromEntries(
    body
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line): [string, string] => {
        const match = DECLARATION.exec(line);
        return [match?.[1] ?? line.trim(), match?.[2] ?? ''];
      }),
  );
};

const COLOUR_RESET = '--color-*';

describe('the global stylesheet', () => {
  it('declares in @theme exactly the tokens the tokens module holds, after resetting the colours', () => {
    const { [COLOUR_RESET]: reset, ...declarations } = themeBlock(stylesheet);
    expect(reset).toBe('initial');
    expect(declarations).toEqual(themeDeclarations());
  });

  it('resets the colours before declaring any token, so only token colours exist', () => {
    const body = THEME_BLOCK.exec(stylesheet)?.[1] ?? '';
    const firstDeclaration = body.split('\n').find((line) => line.trim() !== '');
    expect(firstDeclaration?.trim()).toBe(`${COLOUR_RESET}: initial;`);
  });

  it('keeps Tailwind, so its non-colour utilities stay available', () => {
    expect(stylesheet).toMatch(/^@import "tailwindcss";$/mu);
  });
});
