const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function roundedAway(value: number): number {
  const size = Math.abs(value);
  const unit = Math.max(1, 10 ** Math.floor(Math.log10(size)) / 2);
  return Math.sign(value) * Math.ceil(size / unit) * unit;
}

export function fittedDomain(values: readonly number[]): readonly [number, number] {
  const lowest = roundedAway(Math.min(0, ...values));
  const highest = roundedAway(Math.max(0, ...values));
  return lowest === highest ? [0, 1] : [lowest, highest];
}

export function monthTick(month: string): string {
  return `${month.slice(2, 4)}.${month.slice(5, 7)}`;
}

export function compactAmount(amount: number): string {
  return COMPACT.format(amount);
}
