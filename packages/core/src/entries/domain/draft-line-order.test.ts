import { describe, expect, it } from 'vitest';
import { type Side } from '@repo/contracts';
import { draftLinesInOrder } from './draft-line-order';

const line = (side: Side, account: string): { readonly side: Side; readonly account: string } => ({
  side,
  account,
});

describe('draftLinesInOrder', () => {
  it('puts every debit before every credit, each Side keeping the order the lines were chosen in', () => {
    expect(
      draftLinesInOrder([
        line('credit', 'sales'),
        line('debit', 'expense'),
        line('credit', 'payable'),
        line('debit', 'cash'),
      ]),
    ).toEqual([
      line('debit', 'expense'),
      line('debit', 'cash'),
      line('credit', 'sales'),
      line('credit', 'payable'),
    ]);
  });

  it('leaves a draft already in order as it is', () => {
    const lines = [line('debit', 'cash'), line('debit', 'expense'), line('credit', 'sales')];

    expect(draftLinesInOrder(lines)).toEqual(lines);
  });

  it('keeps a draft of one Side in the order chosen', () => {
    expect(draftLinesInOrder([line('credit', 'sales'), line('credit', 'capital')])).toEqual([
      line('credit', 'sales'),
      line('credit', 'capital'),
    ]);
    expect(draftLinesInOrder([line('debit', 'expense'), line('debit', 'cash')])).toEqual([
      line('debit', 'expense'),
      line('debit', 'cash'),
    ]);
  });

  it('orders nothing to nothing', () => {
    expect(draftLinesInOrder([])).toEqual([]);
  });

  it('carries every field of a line through unchanged', () => {
    const chosen = { side: 'credit' as const, account: 'sales', amount: '5000' };

    expect(draftLinesInOrder([chosen])).toEqual([chosen]);
  });
});
