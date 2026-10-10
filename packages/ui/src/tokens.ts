export const palette = {
  mint: '#2FD0A2',
  'mint-pale': '#DBF3EB',
  'mint-deep': '#0B7A5E',
  'mint-deeper': '#09644D',
  ink: '#0B2B2A',
  'ink-raised': '#133F3C',
  'ink-mid': '#103735',
  mist: '#F2F8F5',
  'mist-pale': '#F6FAF8',
  frost: '#EAF7F2',
  white: '#FFFFFF',
  slate: '#4A6461',
  sage: '#9FC4BC',
  fog: '#E1ECE8',
  steel: '#78948F',
  rust: '#B4400F',
  ochre: '#A15C00',
  cobalt: '#2B63B8',
  gold: '#7F6500',
  pewter: '#747775',
  azure: '#4285F4',
  leaf: '#34A853',
  amber: '#FBBC05',
  scarlet: '#EA4335',
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
  'ground-dark-hover': 'ink-mid',
  'surface-hover': 'mist-pale',
  'surface-chosen': 'mint-pale',
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
  { foreground: 'cobalt', background: 'white' },
  { foreground: 'gold', background: 'white' },
  { foreground: 'ink', background: 'mist' },
  { foreground: 'slate', background: 'mist' },
  { foreground: 'mint-deep', background: 'mist' },
  { foreground: 'mint-deeper', background: 'mist' },
  { foreground: 'rust', background: 'mist' },
  { foreground: 'ochre', background: 'mist' },
  { foreground: 'cobalt', background: 'mist' },
  { foreground: 'gold', background: 'mist' },
  { foreground: 'frost', background: 'ink' },
  { foreground: 'sage', background: 'ink' },
  { foreground: 'frost', background: 'ink-raised' },
  { foreground: 'sage', background: 'ink-raised' },
  { foreground: 'frost', background: 'ink-mid' },
  { foreground: 'sage', background: 'ink-mid' },
  { foreground: 'ink', background: 'mint' },
  { foreground: 'white', background: 'rust' },
  { foreground: 'ink', background: 'fog' },
  { foreground: 'mint-deeper', background: 'fog' },
  { foreground: 'ink', background: 'mist-pale' },
  { foreground: 'slate', background: 'mist-pale' },
  { foreground: 'cobalt', background: 'mist-pale' },
  { foreground: 'gold', background: 'mist-pale' },
  { foreground: 'ink', background: 'mint-pale' },
];

export const controlEdgePairs: readonly ColorPair[] = [
  { foreground: 'steel', background: 'white' },
  { foreground: 'steel', background: 'mist' },
  { foreground: 'mint-deep', background: 'white' },
  { foreground: 'mint-deep', background: 'mist' },
  { foreground: 'mint', background: 'ink' },
  { foreground: 'mint', background: 'ink-raised' },
  { foreground: 'mint', background: 'ink-mid' },
  { foreground: 'pewter', background: 'white' },
  { foreground: 'mint-deep', background: 'mist-pale' },
  { foreground: 'mint-deep', background: 'mint-pale' },
];

export type TypeStep = {
  readonly fontFamily: FontFamily;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: 400 | 600;
  readonly letterSpacing?: string;
  readonly caps: boolean;
  readonly tabularNumerals: boolean;
};

export type FontFamily = 'IBM Plex Sans' | 'IBM Plex Mono';

export const fontFaces = {
  sans: 'IBM Plex Sans',
  mono: 'IBM Plex Mono',
} as const satisfies Record<string, FontFamily>;

export type TypeStepName =
  | 'display'
  | 'h1'
  | 'h2'
  | 'title'
  | 'body'
  | 'body-sm'
  | 'body-dense'
  | 'label'
  | 'figure'
  | 'date';

export const typeScale: Readonly<Record<TypeStepName, TypeStep>> = {
  display: {
    fontFamily: fontFaces.sans,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    caps: false,
    tabularNumerals: false,
  },
  h1: {
    fontFamily: fontFaces.sans,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: 600,
    letterSpacing: '-0.015em',
    caps: false,
    tabularNumerals: false,
  },
  h2: {
    fontFamily: fontFaces.sans,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: 600,
    caps: false,
    tabularNumerals: false,
  },
  title: {
    fontFamily: fontFaces.sans,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: 600,
    letterSpacing: '-0.005em',
    caps: false,
    tabularNumerals: false,
  },
  body: {
    fontFamily: fontFaces.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 400,
    caps: false,
    tabularNumerals: false,
  },
  'body-sm': {
    fontFamily: fontFaces.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 400,
    caps: false,
    tabularNumerals: false,
  },
  'body-dense': {
    fontFamily: fontFaces.sans,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: 400,
    caps: false,
    tabularNumerals: false,
  },
  label: {
    fontFamily: fontFaces.sans,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: 600,
    letterSpacing: '0.04em',
    caps: true,
    tabularNumerals: false,
  },
  figure: {
    fontFamily: fontFaces.mono,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 400,
    caps: false,
    tabularNumerals: true,
  },
  date: {
    fontFamily: fontFaces.mono,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: 400,
    caps: false,
    tabularNumerals: true,
  },
};

export const breakpoints = {
  wide: 720,
  split: 1280,
} as const satisfies Record<string, number>;

export type RadiusName = 'control' | 'panel' | 'card';

export const radii: Readonly<Record<RadiusName, number>> = {
  control: 6,
  panel: 8,
  card: 12,
};

export const controlHeight = 36;

export type ShadowLayer = {
  readonly offsetY: number;
  readonly blur: number;
  readonly opacity: number;
};

export type Shadow = {
  readonly tint: PaletteColor;
  readonly layers: readonly ShadowLayer[];
};

export type ShadowName = 'lift' | 'lift-card';

export const shadows: Readonly<Record<ShadowName, Shadow>> = {
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
};

const ROOT_FONT_SIZE = 16;

const px = (value: number): string => `${String(value)}px`;

const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

export function rgbChannels(color: string): readonly [number, number, number] {
  if (!HEX_COLOR.test(color)) {
    throw new Error(`Expected a colour as #RRGGBB, got ${color}`);
  }
  const rgb = Number.parseInt(color.slice(1), 16);
  return [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff];
}

function shadowValue({ tint, layers }: Shadow): string {
  const channels = rgbChannels(palette[tint]).map(String).join(' ');
  return layers
    .map(
      (layer) =>
        `0 ${px(layer.offsetY)} ${px(layer.blur)} rgb(${channels} / ${String(layer.opacity)})`,
    )
    .join(', ');
}

const fontVariable = (family: FontFamily): string =>
  `--font-${family.toLowerCase().replaceAll(' ', '-')}`;

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
  const faces = Object.entries(fontFaces).map(([role, family]): [string, string] => [
    `--font-${role}`,
    `var(${fontVariable(family)})`,
  ]);
  const type = Object.entries(typeScale).flatMap(([name, step]) =>
    Object.entries(typeDeclarations(name, step)),
  );
  const widths = Object.entries(breakpoints).map(([name, width]): [string, string] => [
    `--breakpoint-${name}`,
    `${String(width / ROOT_FONT_SIZE)}rem`,
  ]);
  const corners = Object.entries(radii).map(([name, radius]): [string, string] => [
    `--radius-${name}`,
    px(radius),
  ]);
  const lifts = Object.entries(shadows).map(([name, shadow]): [string, string] => [
    `--shadow-${name}`,
    shadowValue(shadow),
  ]);
  return Object.fromEntries([
    ...colors,
    ...faces,
    ...type,
    ...widths,
    ...corners,
    ...lifts,
    ['--height-control', px(controlHeight)],
  ]);
}
