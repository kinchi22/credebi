import {
  amountTextSchema,
  domainError,
  err,
  ok,
  type Err,
  type DomainError,
  type Money,
  type Result,
  type Side,
} from '@repo/contracts';
import {
  addMoney,
  isZeroMoney,
  money,
  moneyToMinorUnits,
  negateMoney,
  sumMoney,
} from '../../money/domain/money';

export type DraftLine = {
  readonly side: Side;
  readonly amount: string;
};

export type DraftTotals = {
  readonly debit: Money;
  readonly credit: Money;
  readonly difference: Money;
};

const tooLarge = (message: string): Err<DomainError> =>
  err(domainError('INVALID_INPUT', message));

function typedAmounts(lines: readonly DraftLine[], side: Side): Result<Money[], DomainError> {
  const amounts: Money[] = [];
  for (const line of lines) {
    if (line.side !== side || !amountTextSchema.safeParse(line.amount).success) {
      continue;
    }
    const amount = money(Number(line.amount));
    if (!amount.ok) {
      return tooLarge('A line has more than an amount can hold.');
    }
    amounts.push(amount.value);
  }
  return ok(amounts);
}

function sideTotal(lines: readonly DraftLine[], side: Side): Result<Money, DomainError> {
  const amounts = typedAmounts(lines, side);
  if (!amounts.ok) {
    return amounts;
  }
  const total = sumMoney(amounts.value);
  return total.ok ? total : tooLarge(`The ${side}s add up to more than an amount can hold.`);
}

export function draftTotals(lines: readonly DraftLine[]): Result<DraftTotals, DomainError> {
  const debit = sideTotal(lines, 'debit');
  if (!debit.ok) {
    return debit;
  }
  const credit = sideTotal(lines, 'credit');
  if (!credit.ok) {
    return credit;
  }
  const difference = addMoney(debit.value, negateMoney(credit.value));
  return difference.ok
    ? ok({ debit: debit.value, credit: credit.value, difference: difference.value })
    : difference;
}

export type DifferenceFill<Line extends DraftLine> = {
  readonly line: Line;
  readonly amount: Money;
};

export function differenceFill<Line extends DraftLine>(
  lines: readonly Line[],
): DifferenceFill<Line> | undefined {
  const totals = draftTotals(lines);
  if (!totals.ok || isZeroMoney(totals.value.difference)) {
    return undefined;
  }
  const { difference } = totals.value;
  const short: Side = moneyToMinorUnits(difference) > 0 ? 'credit' : 'debit';
  const empty = lines.filter((line) => line.side === short && line.amount.trim() === '');
  const [line] = empty;
  if (line === undefined || empty.length > 1) {
    return undefined;
  }
  return { line, amount: short === 'credit' ? difference : negateMoney(difference) };
}
