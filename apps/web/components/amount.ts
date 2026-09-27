import { type Money } from '@repo/contracts';

const WHOLE_UNITS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatAmount(amount: Money): string {
  return WHOLE_UNITS.format(amount);
}
