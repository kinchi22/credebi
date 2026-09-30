import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  CONTROL_EDGE_MINIMUM,
  controlEdgePairs,
  palette,
  semanticColors,
  TEXT_MINIMUM,
  textPairs,
  themeDeclarations,
  typeScale,
} from './tokens';

const ratio = (foreground: keyof typeof palette, background: keyof typeof palette): number =>
  contrastRatio(palette[foreground], palette[background]);

describe('the declared pairs', () => {
  it.each(textPairs.map((pair) => [pair.foreground, pair.background] as const))(
    'reads %s text on %s at WCAG AA or better',
    (foreground, background) => {
      expect(ratio(foreground, background)).toBeGreaterThanOrEqual(TEXT_MINIMUM);
    },
  );

  it.each(controlEdgePairs.map((pair) => [pair.foreground, pair.background] as const))(
    'shows a %s control edge on %s at 3:1 or better',
    (foreground, background) => {
      expect(ratio(foreground, background)).toBeGreaterThanOrEqual(CONTROL_EDGE_MINIMUM);
    },
  );

  it('holds text to 4.5:1 and a control edge to 3:1, the AA thresholds', () => {
    expect(TEXT_MINIMUM).toBe(4.5);
    expect(CONTROL_EDGE_MINIMUM).toBe(3);
  });

  it('pairs every text colour with the grounds it is read on', () => {
    const foregroundsOn = (background: keyof typeof palette): readonly string[] =>
      textPairs.filter((pair) => pair.background === background).map((pair) => pair.foreground);

    expect(foregroundsOn('white')).toEqual(
      expect.arrayContaining(['ink', 'slate', 'mint-deep', 'mint-deeper', 'rust', 'ochre']),
    );
    expect(foregroundsOn('mist')).toEqual(foregroundsOn('white'));
    expect(foregroundsOn('ink')).toEqual(['frost', 'sage']);
    expect(foregroundsOn('ink-raised')).toEqual(['frost', 'sage']);
    expect(foregroundsOn('mint')).toEqual(['ink']);
  });

  it('checks the control edge and the focus ring on both light grounds', () => {
    expect(controlEdgePairs).toEqual([
      { foreground: 'steel', background: 'white' },
      { foreground: 'steel', background: 'mist' },
      { foreground: 'mint-deep', background: 'white' },
      { foreground: 'mint-deep', background: 'mist' },
    ]);
  });
});

describe('the semantic tokens', () => {
  it('map each role onto the brand palette', () => {
    expect(semanticColors).toEqual({
      surface: 'white',
      ground: 'mist',
      text: 'ink',
      'text-muted': 'slate',
      'text-on-dark': 'frost',
      'text-muted-on-dark': 'sage',
      accent: 'mint',
      'accent-text': 'mint-deep',
      border: 'fog',
      'border-control': 'steel',
      danger: 'rust',
      warning: 'ochre',
      positive: 'mint-deep',
      focus: 'mint-deep',
    });
  });
});

describe('themeDeclarations', () => {

  it('declares each semantic colour at its palette value', () => {
    const declarations = themeDeclarations();
    expect(declarations['--color-surface']).toBe('#FFFFFF');
    expect(declarations['--color-text']).toBe('#0B2B2A');
    expect(declarations['--color-border-control']).toBe('#78948F');
    expect(declarations['--color-accent-text']).toBe('#0B7A5E');
  });

  it('declares no palette colour, so components can reach only a role', () => {
    const declarations = themeDeclarations();
    expect(declarations['--color-mint']).toBeUndefined();
    expect(declarations['--color-ink']).toBeUndefined();
  });

  it('declares size, line height and weight for every step of the type scale', () => {
    const declarations = themeDeclarations();
    for (const [name, step] of Object.entries(typeScale)) {
      expect(declarations[`--text-${name}`]).toBe(`${String(step.fontSize)}px`);
      expect(declarations[`--text-${name}--line-height`]).toBe(`${String(step.lineHeight)}px`);
      expect(declarations[`--text-${name}--font-weight`]).toBe(String(step.fontWeight));
    }
  });

  it('declares letter spacing only where a step sets it', () => {
    const declarations = themeDeclarations();
    expect(declarations['--text-display--letter-spacing']).toBe('-0.01em');
    expect(declarations['--text-label--letter-spacing']).toBe('0.06em');
    expect(declarations['--text-body--letter-spacing']).toBeUndefined();
  });

  it('declares nothing but the colours and the type scale', () => {
    const declarations = themeDeclarations();
    const colours = Object.keys(semanticColors).length;
    const typeSteps = Object.values(typeScale);
    const spacing = typeSteps.filter((step) => step.letterSpacing !== undefined).length;
    expect(Object.keys(declarations)).toHaveLength(colours + typeSteps.length * 3 + spacing);
  });
});

describe('the type scale', () => {
  it('sets nothing smaller than 12px', () => {
    for (const step of Object.values(typeScale)) {
      expect(step.fontSize).toBeGreaterThanOrEqual(12);
    }
  });

  it('sets prose in Sora and labels, figures and dates in DM Mono', () => {
    const familyOf = Object.fromEntries(
      Object.entries(typeScale).map(([name, step]) => [name, step.fontFamily]),
    );
    expect(familyOf).toEqual({
      display: 'Sora',
      h1: 'Sora',
      h2: 'Sora',
      body: 'Sora',
      'body-sm': 'Sora',
      label: 'DM Mono',
      figure: 'DM Mono',
      date: 'DM Mono',
    });
  });

  it('sets labels in capitals and figures in tabular numerals', () => {
    expect(typeScale.label.caps).toBe(true);
    expect(typeScale.figure.tabularNumerals).toBe(true);
    expect(typeScale.body.caps).toBe(false);
    expect(typeScale.body.tabularNumerals).toBe(false);
  });
});
