const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export function fittedDomain(values: readonly number[]): readonly [number, number] {
  return [Math.min(0, ...values), Math.max(0, ...values)];
}

export function monthTick(month: string): string {
  return `${month.slice(2, 4)}.${month.slice(5, 7)}`;
}

export function compactAmount(amount: number): string {
  return COMPACT.format(amount);
}
