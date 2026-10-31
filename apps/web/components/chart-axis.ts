const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const STEP_MULTIPLES = [1, 2, 2.5, 5] as const;

const MOST_STEPS = 4;

function stepFor(span: number): number {
  const rough = span / MOST_STEPS;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = STEP_MULTIPLES.map((multiple) => multiple * power).find((candidate) => candidate >= rough);
  return Math.max(1, step ?? 10 * power);
}

export function fittedTicks(values: readonly number[]): readonly number[] {
  const lowest = Math.min(0, ...values);
  const highest = Math.max(0, ...values);
  if (lowest === highest) {
    return [0, 1];
  }
  const step = stepFor(highest - lowest);
  const first = Math.floor(lowest / step);
  const last = Math.ceil(highest / step);
  return Array.from({ length: last - first + 1 }, (_, index) => (first + index) * step);
}

export function monthTick(month: string): string {
  return `${month.slice(2, 4)}.${month.slice(5, 7)}`;
}

export function compactAmount(amount: number): string {
  return COMPACT.format(amount);
}
