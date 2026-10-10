import { readFileSync } from 'node:fs';
import path from 'node:path';
import { palette, radii, semanticColors, type TypeStep, typeScale } from '@repo/ui/tokens';
import { describe, expect, it } from 'vitest';
import { type DesignTokens, readDesignTokens } from './design-shape';
import { REPO_ROOT } from './run-gate';

const typographyOf = (step: TypeStep): Record<string, string> => ({
  fontFamily: step.fontFamily,
  fontSize: `${String(step.fontSize)}px`,
  fontWeight: String(step.fontWeight),
  lineHeight: `${String(step.lineHeight)}px`,
  ...(step.letterSpacing === undefined ? {} : { letterSpacing: step.letterSpacing }),
  ...(step.tabularNumerals ? { fontFeature: '"tnum" 1' } : {}),
});

const fromTokensModule = (): DesignTokens => ({
  colors: {
    ...palette,
    ...Object.fromEntries(
      Object.entries(semanticColors).map(([role, color]) => [role, `{colors.${color}}`]),
    ),
  },
  typography: Object.fromEntries(
    Object.entries(typeScale).map(([name, step]) => [name, typographyOf(step)]),
  ),
  rounded: Object.fromEntries(
    Object.entries(radii).map(([name, radius]) => [name, `${String(radius)}px`]),
  ),
});

describe('docs/DESIGN.md', () => {
  it('states the same palette, semantic tokens, type scale and radii as the tokens module', () => {
    const document = readFileSync(path.join(REPO_ROOT, 'docs', 'DESIGN.md'), 'utf8');
    expect(readDesignTokens(document)).toEqual(fromTokensModule());
  });
});

describe('readDesignTokens', () => {
  const document = [
    '---',
    'name: Example',
    'colors:',
    '  mint: "#2FD0A2"',
    '  accent: "{colors.mint}"',
    'typography:',
    '  body:',
    '    fontFamily: IBM Plex Sans',
    '    fontSize: 15px',
    '  label:',
    '    fontFeature: \'"tnum" 1\'',
    'rounded:',
    '  control: 6px',
    'components:',
    '  button:',
    '    textColor: "{colors.mint}"',
    '---',
    '',
    '# Example',
    '',
    'colors:',
    '  ignored: "#000000"',
    '',
  ].join('\n');

  it('reads colours, type steps and radii from the front matter alone', () => {
    expect(readDesignTokens(document)).toEqual({
      colors: { mint: '#2FD0A2', accent: '{colors.mint}' },
      typography: {
        body: { fontFamily: 'IBM Plex Sans', fontSize: '15px' },
        label: { fontFeature: '"tnum" 1' },
      },
      rounded: { control: '6px' },
    });
  });

  it('reads a document with no front matter as holding no tokens', () => {
    expect(readDesignTokens('# Example\n')).toEqual({ colors: {}, typography: {}, rounded: {} });
  });

  it('reads a changed value as changed, so drift from the tokens module is caught', () => {
    const drifted = document.replace('#2FD0A2', '#0E9A76');
    expect(readDesignTokens(drifted).colors['mint']).toBe('#0E9A76');
  });
});
