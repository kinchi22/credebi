'use client';

import { useState, type ReactNode } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';

type Point = {
  readonly month: string;
  readonly assets: number;
  readonly liabilities: number;
  readonly netWorth: number;
};

type SeriesKey = 'assets' | 'liabilities' | 'netWorth';

const DATA: readonly Point[] = Array.from({ length: 24 }, (_, i) => {
  const year = 2024 + Math.floor((10 + i) / 12);
  const month = ((10 + i) % 12) + 1;
  const assets = Math.round(
    18_000_000 + i * 1_050_000 + Math.sin(i / 2) * 1_200_000 - (i >= 9 && i <= 11 ? 3_000_000 : 0),
  );
  const liabilities = Math.round(30_000_000 - i * 350_000 + (i >= 6 ? 4_000_000 : 0));
  return {
    month: `${String(year)}-${String(month).padStart(2, '0')}`,
    assets,
    liabilities,
    netWorth: assets - liabilities,
  };
});

const MORTGAGE: readonly Point[] = DATA.map((point, i) => {
  const assets = Math.round(9_000_000 + i * 220_000 + Math.sin(i / 1.5) * 900_000);
  const liabilities = Math.round(104_000_000 - i * 380_000 + (i === 14 ? 1_500_000 : 0));
  return { month: point.month, assets, liabilities, netWorth: assets - liabilities };
});

const SERIES: readonly {
  readonly key: SeriesKey;
  readonly label: string;
  readonly color: string;
  readonly dash?: string;
}[] = [
  { key: 'netWorth', label: 'Net worth', color: 'var(--color-accent-text)' },
  { key: 'assets', label: 'Total assets', color: 'var(--color-debit)' },
  { key: 'liabilities', label: 'Total liabilities', color: 'var(--color-danger)', dash: '6 4' },
];

const full = new Intl.NumberFormat('ko-KR');
const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });
const monthLabel = (month: string): string => `${month.slice(2, 4)}.${month.slice(5, 7)}`;

const AXIS = {
  tick: { fill: 'var(--color-text-muted)', fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

export const VARIANTS = [
  { key: 'A', name: 'Clean lines' },
  { key: 'M', name: 'Clean lines, mortgage household' },
  { key: 'B', name: 'Net worth hero area' },
  { key: 'C', name: 'Mirrored assets / liabilities' },
] as const;

export function TrendVariant({ variant }: { readonly variant: string }): ReactNode {
  const [shown, setShown] = useState<Record<SeriesKey, boolean>>({
    netWorth: true,
    assets: true,
    liabilities: true,
  });
  const toggle = (key: SeriesKey): void => setShown((s) => ({ ...s, [key]: !s[key] }));
  if (variant === 'B') {
    return <VariantB shown={shown} toggle={toggle} />;
  }
  if (variant === 'C') {
    return <VariantC shown={shown} toggle={toggle} />;
  }
  return <VariantA shown={shown} toggle={toggle} data={variant === 'M' ? MORTGAGE : DATA} />;
}

type VariantProps = {
  readonly shown: Record<SeriesKey, boolean>;
  readonly toggle: (key: SeriesKey) => void;
};

function TooltipCard({ active, payload, label }: TooltipContentProps): ReactNode {
  if (active !== true || payload.length === 0) {
    return null;
  }
  const point = payload[0]?.payload as Point | undefined;
  if (point === undefined) {
    return null;
  }
  return (
    <div className="min-w-56 rounded-card border border-border bg-surface px-4 py-3 shadow-lift">
      <div className="mb-2 text-label uppercase text-text-muted">{String(label)}</div>
      {SERIES.map((series) => (
        <div key={series.key} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-2 text-body-dense text-text">
            <svg width="18" height="6" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke={series.color}
                strokeWidth="2.5"
                strokeDasharray={series.dash}
              />
            </svg>
            {series.label}
          </span>
          <span
            className={`font-mono text-figure ${
              series.key === 'netWorth' ? 'font-semibold' : ''
            } ${point[series.key] < 0 ? 'text-danger' : 'text-text'}`}
          >
            {full.format(point[series.key])}
          </span>
        </div>
      ))}
    </div>
  );
}

function PillToggles({ shown, toggle }: VariantProps): ReactNode {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Lines">
      {SERIES.map((series) => (
        <button
          key={series.key}
          type="button"
          aria-pressed={shown[series.key]}
          onClick={() => toggle(series.key)}
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-body-dense transition ${
            shown[series.key]
              ? 'border-border-control bg-surface text-text'
              : 'border-border bg-ground text-text-muted line-through'
          }`}
        >
          <svg width="18" height="6" aria-hidden="true">
            <line
              x1="0"
              y1="3"
              x2="18"
              y2="3"
              stroke={shown[series.key] ? series.color : 'var(--color-border-control)'}
              strokeWidth="2.5"
              strokeDasharray={series.dash}
            />
          </svg>
          {series.label}
        </button>
      ))}
    </div>
  );
}

function LegendToggles({ shown, toggle }: VariantProps): ReactNode {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1" role="group" aria-label="Lines">
      {SERIES.map((series) => (
        <button
          key={series.key}
          type="button"
          aria-pressed={shown[series.key]}
          onClick={() => toggle(series.key)}
          className={`flex items-center gap-2 py-1 text-body-dense transition hover:text-text ${
            shown[series.key] ? 'text-text' : 'text-text-muted opacity-50'
          }`}
        >
          <svg width="18" height="6" aria-hidden="true">
            <line
              x1="0"
              y1="3"
              x2="18"
              y2="3"
              stroke={shown[series.key] ? series.color : 'var(--color-border-control)'}
              strokeWidth="2.5"
              strokeDasharray={series.dash}
            />
          </svg>
          {series.label}
        </button>
      ))}
    </div>
  );
}

const ACTIVE_DOT_STYLE = `
@keyframes trend-dot-pop {
  0% { transform: scale(0.5); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.trend-active-dot {
  transform-box: fill-box;
  transform-origin: center;
  animation: trend-dot-pop 220ms ease-out;
}
`;

function ActiveDot({
  cx,
  cy,
  color,
}: {
  readonly cx: number | undefined;
  readonly cy: number | undefined;
  readonly color: string;
}): ReactNode {
  if (cx === undefined || cy === undefined) {
    return null;
  }
  return (
    <circle
      className="trend-active-dot"
      cx={cx}
      cy={cy}
      r={6.5}
      fill={color}
      stroke="var(--color-surface)"
      strokeWidth={3}
      style={{ filter: 'drop-shadow(0 1px 2px rgb(11 43 42 / 0.25))' }}
    />
  );
}

function VariantA({
  shown,
  toggle,
  data,
}: VariantProps & { readonly data: readonly Point[] }): ReactNode {
  return (
    <section className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4 wide:p-6">
      <style>{ACTIVE_DOT_STYLE}</style>
      <div className="h-80 wide:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="month" tickFormatter={monthLabel} minTickGap={24} {...AXIS} />
            <YAxis tickFormatter={(v: number) => compact.format(v)} width={64} {...AXIS} />
            <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeDasharray="2 3" />
            <Tooltip content={TooltipCard} cursor={{ stroke: 'var(--color-border-control)' }} />
            {SERIES.map((series) => (
              <Line
                key={series.key}
                dataKey={series.key}
                name={series.label}
                hide={!shown[series.key]}
                type="monotone"
                stroke={series.color}
                strokeWidth={series.key === 'netWorth' ? 3 : 2}
                strokeDasharray={series.dash ?? '0'}
                dot={{ r: 3, fill: series.color, stroke: series.color, strokeWidth: 0, strokeDasharray: '0' }}
                activeDot={(props: { cx?: number | undefined; cy?: number | undefined }) => (
                  <ActiveDot key={`${series.key}-${String(props.cx)}`} cx={props.cx} cy={props.cy} color={series.color} />
                )}
                animationDuration={700}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <LegendToggles shown={shown} toggle={toggle} />
    </section>
  );
}

function VariantB({ shown, toggle }: VariantProps): ReactNode {
  const values = DATA.map((point) => point.netWorth);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const zero = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min);
  const first = DATA[0];
  const last = DATA[DATA.length - 1];
  const change = first !== undefined && last !== undefined ? last.netWorth - first.netWorth : 0;
  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-lift wide:p-8">
      <div className="text-label uppercase text-text-muted">Net worth · {last?.month}</div>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-display text-text">{full.format(last?.netWorth ?? 0)}</span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-body-dense ${
            change >= 0 ? 'bg-surface-chosen text-positive' : 'bg-ground text-danger'
          }`}
        >
          {change >= 0 ? '▲' : '▼'} {full.format(Math.abs(change))} since {first?.month}
        </span>
      </div>
      <div className="mt-2 h-80 wide:h-[26rem]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={DATA} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="nw-stroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={zero} stopColor="var(--color-accent-text)" />
                <stop offset={zero} stopColor="var(--color-danger)" />
              </linearGradient>
              <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--color-accent)" stopOpacity={0.35} />
                <stop offset={zero} stopColor="var(--color-accent)" stopOpacity={0.04} />
                <stop offset={zero} stopColor="var(--color-danger)" stopOpacity={0.04} />
                <stop offset="1" stopColor="var(--color-danger)" stopOpacity={0.25} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tickFormatter={monthLabel} minTickGap={32} {...AXIS} />
            <YAxis hide domain={['auto', 'auto']} />
            <ReferenceLine
              y={0}
              stroke="var(--color-border-control)"
              label={{ value: '0', position: 'insideLeft', fill: 'var(--color-text-muted)', fontSize: 11 }}
            />
            <Tooltip content={TooltipCard} cursor={{ stroke: 'var(--color-border-control)', strokeDasharray: '3 3' }} />
            <Line
              dataKey="assets"
              hide={!shown.assets}
              type="monotone"
              stroke="var(--color-debit)"
              strokeOpacity={0.55}
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              dataKey="liabilities"
              hide={!shown.liabilities}
              type="monotone"
              stroke="var(--color-danger)"
              strokeOpacity={0.55}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
            />
            <Area
              dataKey="netWorth"
              hide={!shown.netWorth}
              type="monotone"
              stroke="url(#nw-stroke)"
              strokeWidth={3}
              fill="url(#nw-fill)"
              activeDot={{ r: 6, strokeWidth: 3, stroke: 'var(--color-surface)', fill: 'var(--color-text)' }}
              animationDuration={900}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <PillToggles shown={shown} toggle={toggle} />
    </section>
  );
}

function VariantC({ shown, toggle }: VariantProps): ReactNode {
  const last = DATA[DATA.length - 1];
  return (
    <section className="flex flex-col gap-6 split:flex-row">
      <div className="h-96 min-w-0 flex-1 rounded-panel border border-border bg-surface p-4 wide:h-[28rem]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={DATA} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} stackOffset="sign">
            <defs>
              <linearGradient id="assets-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--color-debit)" stopOpacity={0.45} />
                <stop offset="1" stopColor="var(--color-debit)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="liabilities-fill" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="var(--color-danger)" stopOpacity={0.4} />
                <stop offset="1" stopColor="var(--color-danger)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="2 4" />
            <XAxis dataKey="month" tickFormatter={monthLabel} minTickGap={24} {...AXIS} />
            <YAxis tickFormatter={(v: number) => compact.format(v)} width={64} {...AXIS} />
            <ReferenceLine y={0} stroke="var(--color-text)" strokeWidth={1} />
            <Tooltip content={TooltipCard} cursor={{ fill: 'var(--color-surface-hover)' }} />
            <Area
              dataKey="assets"
              hide={!shown.assets}
              type="monotone"
              stroke="var(--color-debit)"
              strokeWidth={1.5}
              fill="url(#assets-fill)"
              dot={false}
            />
            <Area
              dataKey={(point: Point) => -point.liabilities}
              name="liabilities"
              hide={!shown.liabilities}
              type="monotone"
              stroke="var(--color-danger)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              fill="url(#liabilities-fill)"
              dot={false}
            />
            <Line
              dataKey="netWorth"
              hide={!shown.netWorth}
              type="monotone"
              stroke="var(--color-text)"
              strokeWidth={3}
              dot={{ r: 2.5, fill: 'var(--color-text)', strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 3, stroke: 'var(--color-surface)', fill: 'var(--color-accent-text)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-2 split:w-72" aria-label="Lines">
        {SERIES.map((series) => (
          <li key={series.key}>
            <button
              type="button"
              aria-pressed={shown[series.key]}
              onClick={() => toggle(series.key)}
              className={`flex w-full flex-col items-start gap-1 rounded-panel border-l-4 bg-surface px-4 py-3 text-left transition ${
                shown[series.key] ? 'opacity-100' : 'opacity-45'
              }`}
              style={{ borderLeftColor: series.key === 'netWorth' ? 'var(--color-text)' : series.color }}
            >
              <span className="text-label uppercase text-text-muted">
                {series.label} · {shown[series.key] ? 'shown' : 'hidden'}
              </span>
              <span
                className={`font-mono text-h2 ${
                  (last?.[series.key] ?? 0) < 0 ? 'text-danger' : 'text-text'
                }`}
              >
                {full.format(last?.[series.key] ?? 0)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
