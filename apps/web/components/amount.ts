import { type Money } from '@repo/contracts';

export function formatAmount(amount: Money): string {
  return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
