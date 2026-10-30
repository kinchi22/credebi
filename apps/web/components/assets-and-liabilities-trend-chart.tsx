'use client';

import { useTranslations } from 'next-intl';
import { trendSeriesSchema, type TrendMonthOutput, type TrendSeries } from '@repo/contracts';
import { type ReactNode, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { formatAmount } from './amount';
import { compactAmount, fittedTicks, monthTick } from './chart-axis';
import { toggledSeries } from './chart-series';
import {
  activeDotLook,
  AXIS_LOOK,
  ChartLegend,
  ChartTooltipCard,
  CURSOR_LOOK,
  dotLook,
  GRID_LOOK,
  strokeWidthOf,
  SOLID,
  ZERO_LINE_LOOK,
  type ChartSeriesLook,
} from './chart-look';
import { useMonthLabel } from './use-month-label';

const FULL = '100%';

const MONTH_KEY = 'month';

const SERIES: readonly { readonly key: TrendSeries; readonly look: ChartSeriesLook }[] = [
  { key: 'netWorth', look: { color: 'var(--color-accent-text)', emphasised: true } },
  { key: 'totalAssets', look: { color: 'var(--color-debit)' } },
  { key: 'totalLiabilities', look: { color: 'var(--color-danger)', dash: '6 4' } },
];

const ALL_SERIES: readonly TrendSeries[] = trendSeriesSchema.options;

const UNIT_TICKS: readonly number[] = [0, 1];

export type KeepShownLines = (shownSeriesIds: readonly string[]) => Promise<void>;

export type ShownLines = {
  readonly shown: readonly string[];
  readonly keep: KeepShownLines;
};

export type AssetsAndLiabilitiesTrendChartProps = {
  readonly months: readonly TrendMonthOutput[];
  readonly lines: ShownLines;
};

export function AssetsAndLiabilitiesTrendChart({ months, lines }: AssetsAndLiabilitiesTrendChartProps): ReactNode {
  const t = useTranslations();
  const monthLabel = useMonthLabel();
  const labelOf = (key: TrendSeries): string => t(`assetsAndLiabilities.${key}`);
  const [shown, setShown] = useState<readonly TrendSeries[]>(() =>
    ALL_SERIES.filter((key) => lines.shown.includes(key)),
  );
  const [kept, setKept] = useState<readonly number[]>(UNIT_TICKS);
  const ticks =
    shown.length === 0 ? kept : fittedTicks(months.flatMap((month) => shown.map((key) => month[key])));
  const domain = [ticks[0] ?? 0, ticks[ticks.length - 1] ?? 0];

  const toggle = (key: TrendSeries): void => {
    const next = toggledSeries(ALL_SERIES, shown, key);
    if (next.length === 0) {
      setKept(ticks);
    }
    setShown(next);
    lines.keep(next).catch(() => undefined);
  };

  const tooltip = ({ active, label }: TooltipContentProps): ReactNode => {
    const month = months.find((candidate) => candidate.month === label);
    if (!active || month === undefined) {
      return null;
    }
    return (
      <ChartTooltipCard
        title={monthLabel(month.month)}
        rows={SERIES.map(({ key, look }) => ({
          key,
          label: labelOf(key),
          look,
          value: formatAmount(month[key]),
          negative: month[key] < 0,
        }))}
      />
    );
  };

  return (
    <>
      <div className="h-80 min-w-0 wide:h-96">
        <ResponsiveContainer width={FULL} height={FULL}>
          <LineChart
            data={[...months]}
            margin={{ top: 12, right: 16, bottom: 0, left: 0 }}
            aria-label={t('assetsAndLiabilitiesTrendPage.title')}
          >
            <CartesianGrid {...GRID_LOOK} />
            <XAxis dataKey={MONTH_KEY} tickFormatter={monthTick} minTickGap={24} {...AXIS_LOOK} />
            <YAxis
              domain={domain}
              ticks={[...ticks]}
              includeHidden
              allowDataOverflow
              tickFormatter={compactAmount}
              width={56}
              {...AXIS_LOOK}
            />
            <ReferenceLine {...ZERO_LINE_LOOK} />
            <Tooltip content={tooltip} cursor={CURSOR_LOOK} isAnimationActive={false} />
            {SERIES.map(({ key, look }) => (
              <Line
                key={key}
                dataKey={key}
                hide={!shown.includes(key)}
                name={labelOf(key)}
                type="monotone"
                stroke={look.color}
                strokeWidth={strokeWidthOf(look)}
                strokeDasharray={look.dash ?? SOLID}
                dot={dotLook(look)}
                activeDot={activeDotLook(look)}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        label={t('assetsAndLiabilitiesTrend.lines')}
        items={SERIES.map(({ key, look }) => ({ key, label: labelOf(key), look, shown: shown.includes(key) }))}
        onToggle={toggle}
      />
    </>
  );
}
