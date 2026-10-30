import { typeClasses } from '@repo/ui/type-classes';
import { type ReactNode } from 'react';

export type ChartSeriesLook = {
  readonly color: string;
  readonly dash?: string;
  readonly emphasised?: boolean;
};

const DOT_OUTLINE = 'var(--color-surface)';

export const SOLID = '0';

export const AXIS_LOOK = {
  tick: { fill: 'var(--color-text-muted)', className: 'text-label font-sans' },
  tickLine: false,
  axisLine: false,
} as const;

export const GRID_LOOK = { vertical: false, stroke: 'var(--color-border)' } as const;

export const ZERO_LINE_LOOK = { y: 0, stroke: 'var(--color-text-muted)', strokeDasharray: '2 3' } as const;

export const CURSOR_LOOK = { stroke: 'var(--color-border-control)' } as const;

export const strokeWidthOf = ({ emphasised = false }: ChartSeriesLook): number => (emphasised ? 3 : 2);

export const dotLook = ({ color }: ChartSeriesLook) =>
  ({ r: 3, fill: color, stroke: color, strokeWidth: 0, strokeDasharray: SOLID }) as const;

type DotPosition = {
  readonly cx?: number | undefined;
  readonly cy?: number | undefined;
  readonly index?: number | undefined;
};

export const activeDotLook =
  ({ color }: ChartSeriesLook) =>
  ({ cx, cy, index }: DotPosition): ReactNode =>
    cx === undefined || cy === undefined ? null : (
      <circle
        key={`active-${String(index)}`}
        className="chart-active-dot"
        cx={cx}
        cy={cy}
        r={6.5}
        fill={color}
        stroke={DOT_OUTLINE}
        strokeWidth={3}
      />
    );

function SeriesSwatch({ color, dash }: ChartSeriesLook): ReactNode {
  return (
    <svg width={18} height={6} aria-hidden="true" className="shrink-0">
      <line x1={0} y1={3} x2={18} y2={3} stroke={color} strokeWidth={2.5} strokeDasharray={dash} />
    </svg>
  );
}

export type ChartTooltipRow = {
  readonly key: string;
  readonly label: string;
  readonly look: ChartSeriesLook;
  readonly value: string;
  readonly negative: boolean;
};

export type ChartTooltipCardProps = {
  readonly title: string;
  readonly rows: readonly ChartTooltipRow[];
};

export function ChartTooltipCard({ title, rows }: ChartTooltipCardProps): ReactNode {
  return (
    <div role="tooltip" className="min-w-56 rounded-card border border-border bg-surface px-4 py-3 shadow-lift">
      <div className={`mb-2 text-text-muted ${typeClasses.date}`}>{title}</div>
      {rows.map(({ key, label, look, value, negative }) => (
        <div key={key} className="flex items-center justify-between gap-6 py-0.5">
          <span className={`flex items-center gap-2 text-text ${typeClasses['body-dense']}`}>
            <SeriesSwatch {...look} />
            {label}
          </span>
          <span
            className={`${typeClasses.figure} ${look.emphasised === true ? 'font-medium' : ''} ${
              negative ? 'text-danger' : 'text-text'
            }`}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}
