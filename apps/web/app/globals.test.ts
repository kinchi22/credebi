import { readFileSync } from 'node:fs';
import { themeDeclarations } from '@repo/ui/tokens';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

const THEME_BLOCK = /@theme\s*\{([^}]*)\}/u;
const DECLARATION = /^\s*(--[\w-]+)\s*:\s*([^;]+?)\s*;\s*$/u;

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

describe('the global stylesheet', () => {
  it('declares in @theme exactly the tokens the tokens module holds', () => {
    expect(themeBlock(stylesheet)).toEqual(themeDeclarations());
  });

  it('keeps Tailwind and its default theme, so no existing utility changes', () => {
    expect(stylesheet).toMatch(/^@import "tailwindcss";$/mu);
    expect(stylesheet).not.toMatch(/--color-\*\s*:\s*initial/u);
  });
});
