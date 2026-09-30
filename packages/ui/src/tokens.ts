export const palette = {
  mint: '#2FD0A2',
  'mint-deep': '#0B7A5E',
  'mint-deeper': '#09644D',
  ink: '#0B2B2A',
  'ink-raised': '#133F3C',
  mist: '#F2F8F5',
  frost: '#EAF7F2',
  white: '#FFFFFF',
  slate: '#4A6461',
  sage: '#9FC4BC',
  fog: '#E1ECE8',
  steel: '#78948F',
  rust: '#B4400F',
  ochre: '#A15C00',
} as const;

export type PaletteColor = keyof typeof palette;

export const semanticColors = {
  surface: 'white',
  ground: 'mist',
  text: 'ink',
  'text-muted': 'slate',
  'text-on-dark': 'frost',
  'text-muted-on-dark': 'sage',
  'ground-dark': 'ink',
  'ground-dark-raised': 'ink-raised',
  accent: 'mint',
  'accent-text': 'mint-deep',
  border: 'fog',
  'border-control': 'steel',
  danger: 'rust',
  warning: 'ochre',
  positive: 'mint-deep',
  focus: 'mint-deep',
  'focus-on-dark': 'mint',
} as const satisfies Record<string, PaletteColor>;

export type SemanticColor = keyof typeof semanticColors;

export type ColorPair = {
  readonly foreground: PaletteColor;
  readonly background: PaletteColor;
};

export const TEXT_MINIMUM = 4.5;

export const CONTROL_EDGE_MINIMUM = 3;

export const textPairs: readonly ColorPair[] = [
  { foreground: 'ink', background: 'white' },
  { foreground: 'slate', background: 'white' },
  { foreground: 'mint-deep', background: 'white' },
  { foreground: 'mint-deeper', background: 'white' },
  { foreground: 'rust', background: 'white' },
  { foreground: 'ochre', background: 'white' },
  { foreground: 'ink', background: 'mist' },
  { foreground: 'slate', background: 'mist' },
  { foreground: 'mint-deep', background: 'mist' },
  { foreground: 'mint-deeper', background: 'mist' },
  { foreground: 'rust', background: 'mist' },
  { foreground: 'ochre', background: 'mist' },
  { foreground: 'frost', background: 'ink' },
  { foreground: 'sage', background: 'ink' },
  { foreground: 'frost', background: 'ink-raised' },
  { foreground: 'sage', background: 'ink-raised' },
  { foreground: 'ink', background: 'mint' },
];

export const controlEdgePairs: readonly ColorPair[] = [
  { foreground: 'steel', background: 'white' },
  { foreground: 'steel', background: 'mist' },
  { foreground: 'mint-deep', background: 'white' },
  { foreground: 'mint-deep', background: 'mist' },
  { foreground: 'mint', background: 'ink' },
  { foreground: 'mint', background: 'ink-raised' },
];

export type TypeStep = {
  readonly fontFamily: 'Sora' | 'DM Mono';
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: 400 | 600;
  readonly letterSpacing?: string;
  readonly caps: boolean;
  readonly tabularNumerals: boolean;
};

export type TypeStepName =
  | 'display'
  | 'h1'
  | 'h2'
  | 'body'
  | 'body-sm'
  | 'label'
  | 'figure'
  | 'date';

export const typeScale: Readonly<Record<TypeStepName, TypeStep>> = {
  display: {
    fontFamily: 'Sora',
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    caps: false,
    tabularNumerals: false,
  },
  h1: {
    fontFamily: 'Sora',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    caps: false,
    tabularNumerals: false,
  },
  h2: {
    fontFamily: 'Sora',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: 600,
    caps: false,
    tabularNumerals: false,
  },
  body: {
    fontFamily: 'Sora',
    fontSize: 15,
    lineHeight: 24,
    fontWeight: 400,
    caps: false,
    tabularNumerals: false,
  },
  'body-sm': {
    fontFamily: 'Sora',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 400,
    caps: false,
    tabularNumerals: false,
  },
  label: {
    fontFamily: 'DM Mono',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 400,
    letterSpacing: '0.06em',
    caps: true,
    tabularNumerals: false,
  },
  figure: {
    fontFamily: 'DM Mono',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 400,
    caps: false,
    tabularNumerals: true,
  },
  date: {
    fontFamily: 'DM Mono',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: 400,
    caps: false,
    tabularNumerals: false,
  },
};

function typeDeclarations(name: string, step: TypeStep): Record<string, string> {
  const declarations: Record<string, string> = {
    [`--text-${name}`]: `${String(step.fontSize)}px`,
    [`--text-${name}--line-height`]: `${String(step.lineHeight)}px`,
    [`--text-${name}--font-weight`]: String(step.fontWeight),
  };
  if (step.letterSpacing !== undefined) {
    declarations[`--text-${name}--letter-spacing`] = step.letterSpacing;
  }
  return declarations;
}

export function themeDeclarations(): Readonly<Record<string, string>> {
  const colors = Object.entries(semanticColors).map(
    ([role, color]): [string, string] => [`--color-${role}`, palette[color]],
  );
  const type = Object.entries(typeScale).flatMap(([name, step]) =>
    Object.entries(typeDeclarations(name, step)),
  );
  return Object.fromEntries([...colors, ...type]);
}
