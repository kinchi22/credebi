import { readFileSync } from 'node:fs';
import { themeDeclarations } from '@repo/ui/tokens';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');

const LOADED_VARIABLE = /variable:\s*'(--[\w-]+)'/gu;
const REFERENCED_VARIABLE = /^var\((--[\w-]+)\)$/u;

const loadedVariables = [...layout.matchAll(LOADED_VARIABLE)].map((match) => match[1]);

const faceVariables = Object.entries(themeDeclarations())
  .filter(([name]) => name.startsWith('--font-'))
  .map(([, value]) => REFERENCED_VARIABLE.exec(value)?.[1]);

describe('the root layout', () => {
  it('loads a font under every variable the theme sets its faces from', () => {
    expect(faceVariables).toHaveLength(2);
    expect(loadedVariables.toSorted()).toEqual(faceVariables.toSorted());
  });
});
