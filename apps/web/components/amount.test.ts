import type { Money } from '@repo/contracts';
import { describe, expect, it } from 'vitest';
import { formatAmount } from './amount';

describe('formatAmount', () => {
  it('groups the thousands of an amount with commas', () => {
    expect(formatAmount(1234567 as Money)).toBe('1,234,567');
    expect(formatAmount(4500 as Money)).toBe('4,500');
  });

  it('shows an amount under a thousand as it is', () => {
    expect(formatAmount(999 as Money)).toBe('999');
    expect(formatAmount(0 as Money)).toBe('0');
  });

  it('shows a negative amount with a minus sign', () => {
    expect(formatAmount(-12500 as Money)).toBe('-12,500');
  });

  it('shows whole units, with no fraction digits', () => {
    expect(formatAmount(1234.5 as Money)).toBe('1,235');
  });
});
