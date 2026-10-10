import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  breakpoints,
  CONTROL_EDGE_MINIMUM,
  controlEdgePairs,
  controlHeight,
  fontFaces,
  palette,
  radii,
  rgbChannels,
  semanticColors,
  shadows,
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
      expect.arrayContaining([
        'ink',
        'slate',
        'mint-deep',
        'mint-deeper',
        'rust',
        'ochre',
        'cobalt',
        'gold',
      ]),
    );
    expect(foregroundsOn('mist')).toEqual(foregroundsOn('white'));
    expect(foregroundsOn('ink')).toEqual(['frost', 'sage']);
    expect(foregroundsOn('ink-raised')).toEqual(['frost', 'sage']);
    expect(foregroundsOn('ink-mid')).toEqual(['frost', 'sage']);
    expect(foregroundsOn('mint')).toEqual(['ink']);
    expect(foregroundsOn('fog')).toEqual(['ink', 'mint-deeper']);
  });

  it('checks the control edge and the focus ring on every ground', () => {
    expect(controlEdgePairs).toEqual([
      { foreground: 'steel', background: 'white' },
      { foreground: 'steel', background: 'mist' },
      { foreground: 'mint-deep', background: 'white' },
      { foreground: 'mint-deep', background: 'mist' },
      { foreground: 'mint', background: 'ink' },
      { foreground: 'mint', background: 'ink-raised' },
      { foreground: 'mint', background: 'ink-mid' },
      { foreground: 'pewter', background: 'white' },
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
      'ground-dark': 'ink',
      'ground-dark-raised': 'ink-raised',
      'ground-dark-hover': 'ink-mid',
      accent: 'mint',
      'accent-text': 'mint-deep',
      'accent-text-hover': 'mint-deeper',
      border: 'fog',
      band: 'fog',
      'border-control': 'steel',
      danger: 'rust',
      warning: 'ochre',
      positive: 'mint-deep',
      focus: 'mint-deep',
      'focus-on-dark': 'mint',
      debit: 'cobalt',
      credit: 'gold',
      'border-google': 'pewter',
      'google-blue': 'azure',
      'google-green': 'leaf',
      'google-yellow': 'amber',
      'google-red': 'scarlet',
    });
  });

  it("keeps Google's sign-in edge and the four colours of its G exactly as Google publishes them", () => {
    expect(palette[semanticColors['border-google']]).toBe('#747775');
    expect(palette[semanticColors['google-blue']]).toBe('#4285F4');
    expect(palette[semanticColors['google-green']]).toBe('#34A853');
    expect(palette[semanticColors['google-yellow']]).toBe('#FBBC05');
    expect(palette[semanticColors['google-red']]).toBe('#EA4335');
  });

  it('sets Debit in a blue and Credit in a gold that each read as text on the ground', () => {
    expect(palette[semanticColors.debit]).toBe('#2B63B8');
    expect(palette[semanticColors.credit]).toBe('#7F6500');
    expect(ratio(semanticColors.debit, semanticColors.ground)).toBeGreaterThanOrEqual(TEXT_MINIMUM);
    expect(ratio(semanticColors.credit, semanticColors.ground)).toBeGreaterThanOrEqual(TEXT_MINIMUM);
  });
});

describe('the hover fill on dark', () => {
  it('mixes 60% of ink-raised into ink', () => {
    const [ink, raised, mid] = [palette.ink, palette['ink-raised'], palette['ink-mid']].map(
      rgbChannels,
    );
    const mixed = ink?.map((channel, index) =>
      Math.round(channel * 0.4 + (raised?.[index] ?? 0) * 0.6),
    );
    expect(mid).toEqual(mixed);
  });
});

describe('the breakpoints', () => {
  it('holds two breakpoints, wide at 720px and split at 1280px', () => {
    expect(breakpoints).toEqual({ wide: 720, split: 1280 });
  });
});

describe('the shapes', () => {
  it('rounds a control 6px, a panel 8px and the Sign in card 12px', () => {
    expect(radii).toEqual({ control: 6, panel: 8, card: 12 });
  });

  it('stands every control on a light ground 36px tall', () => {
    expect(controlHeight).toBe(36);
  });

  it('lifts a panel faintly and the Sign in card a little deeper, both tinted from ink', () => {
    expect(shadows).toEqual({
      lift: {
        tint: 'ink',
        layers: [
          { offsetY: 1, blur: 2, opacity: 0.05 },
          { offsetY: 1, blur: 3, opacity: 0.04 },
        ],
      },
      'lift-card': {
        tint: 'ink',
        layers: [
          { offsetY: 1, blur: 2, opacity: 0.05 },
          { offsetY: 12, blur: 32, opacity: 0.08 },
        ],
      },
    });
  });
});

describe('themeDeclarations', () => {
  it('sets IBM Plex Sans as the sans face and IBM Plex Mono as the mono face, from the fonts the app serves', () => {
    const declarations = themeDeclarations();
    expect(declarations['--font-sans']).toBe('var(--font-ibm-plex-sans)');
    expect(declarations['--font-mono']).toBe('var(--font-ibm-plex-mono)');
  });

  it('declares each semantic colour at its palette value', () => {
    const declarations = themeDeclarations();
    expect(declarations['--color-surface']).toBe('#FFFFFF');
    expect(declarations['--color-text']).toBe('#0B2B2A');
    expect(declarations['--color-border-control']).toBe('#78948F');
    expect(declarations['--color-accent-text']).toBe('#0B7A5E');
    expect(declarations['--color-accent-text-hover']).toBe('#09644D');
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
    expect(declarations['--text-h1--letter-spacing']).toBe('-0.015em');
    expect(declarations['--text-label--letter-spacing']).toBe('0.04em');
    expect(declarations['--text-body--letter-spacing']).toBeUndefined();
  });

  it('declares each breakpoint in rem, the unit of the breakpoints Tailwind keeps', () => {
    expect(themeDeclarations()['--breakpoint-wide']).toBe('45rem');
    expect(themeDeclarations()['--breakpoint-split']).toBe('80rem');
  });

  it('declares each radius in px', () => {
    const declarations = themeDeclarations();
    expect(declarations['--radius-control']).toBe('6px');
    expect(declarations['--radius-panel']).toBe('8px');
    expect(declarations['--radius-card']).toBe('12px');
  });

  it('declares each shadow in the colour of its tint, layer by layer', () => {
    const declarations = themeDeclarations();
    expect(declarations['--shadow-lift']).toBe(
      '0 1px 2px rgb(11 43 42 / 0.05), 0 1px 3px rgb(11 43 42 / 0.04)',
    );
    expect(declarations['--shadow-lift-card']).toBe(
      '0 1px 2px rgb(11 43 42 / 0.05), 0 12px 32px rgb(11 43 42 / 0.08)',
    );
  });

  it('declares the control height in px', () => {
    expect(themeDeclarations()['--height-control']).toBe('36px');
  });

  it('declares nothing but the colours, the faces, the type scale, the breakpoints, the radii, the shadows and the control height', () => {
    const declarations = themeDeclarations();
    const colours = Object.keys(semanticColors).length;
    const faces = Object.keys(fontFaces).length;
    const typeSteps = Object.values(typeScale);
    const spacing = typeSteps.filter((step) => step.letterSpacing !== undefined).length;
    const widths = Object.keys(breakpoints).length;
    const corners = Object.keys(radii).length;
    const lifts = Object.keys(shadows).length;
    expect(Object.keys(declarations)).toHaveLength(
      colours + faces + typeSteps.length * 3 + spacing + widths + corners + lifts + 1,
    );
  });
});

describe('the type scale', () => {
  it('sets every step in a face the theme declares', () => {
    const declared: readonly string[] = Object.values(fontFaces);
    for (const step of Object.values(typeScale)) {
      expect(declared).toContain(step.fontFamily);
    }
  });

  it('sets nothing smaller than 11.5px', () => {
    for (const step of Object.values(typeScale)) {
      expect(step.fontSize).toBeGreaterThanOrEqual(11.5);
    }
  });

  it('holds the type scale the design states', () => {
    const sans = { fontFamily: 'IBM Plex Sans', caps: false, tabularNumerals: false };
    const mono = { fontFamily: 'IBM Plex Mono', fontWeight: 400, caps: false, tabularNumerals: true };
    expect(typeScale).toEqual({
      display: { ...sans, fontSize: 32, lineHeight: 40, fontWeight: 600, letterSpacing: '-0.01em' },
      h1: { ...sans, fontSize: 22, lineHeight: 30, fontWeight: 600, letterSpacing: '-0.015em' },
      h2: { ...sans, fontSize: 20, lineHeight: 28, fontWeight: 600 },
      title: { ...sans, fontSize: 15, lineHeight: 22, fontWeight: 600, letterSpacing: '-0.005em' },
      body: { ...sans, fontSize: 14, lineHeight: 20, fontWeight: 400 },
      'body-sm': { ...sans, fontSize: 14, lineHeight: 20, fontWeight: 400 },
      'body-dense': { ...sans, fontSize: 13, lineHeight: 20, fontWeight: 400 },
      label: {
        ...sans,
        fontSize: 11.5,
        lineHeight: 16,
        fontWeight: 600,
        letterSpacing: '0.04em',
        caps: true,
      },
      figure: { ...mono, fontSize: 14, lineHeight: 20 },
      date: { ...mono, fontSize: 13, lineHeight: 20 },
    });
  });
});

describe('rgbChannels', () => {
  it('splits a colour into its red, green and blue channels', () => {
    expect(rgbChannels('#0B2B2A')).toEqual([11, 43, 42]);
    expect(rgbChannels('#ff8001')).toEqual([255, 128, 1]);
  });

  it('refuses a colour that is not six hex digits', () => {
    expect(() => rgbChannels('#FFF')).toThrow('#FFF');
  });
});
