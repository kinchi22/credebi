import {
  domainError,
  err,
  ok,
  type AccountId,
  type DomainError,
  type EntryId,
  type Err,
  type Money,
  type Result,
  type Side,
} from '@repo/contracts';
import { accountNames, type Account, type AccountNames } from '../../accounts/domain/account';
import { checkActiveOn } from '../../accounts/domain/active-period';
import { moneyToMinorUnits, sumMoney } from '../../money/domain/money';

export const MEMO_MAX_LENGTH = 200;

export function memoLength(memo: string): number {
  // eslint-disable-next-line @typescript-eslint/no-misused-spread -- ADR-0010 counts a memo in code points, which is what spreading yields
  return [...memo].length;
}

export type EntryLine = {
  readonly account: AccountId;
  readonly accountName: string;
  readonly side: Side;
  readonly amount: Money;
};

export type Entry = {
  readonly id: EntryId;
  readonly entryDate: string;
  readonly memo: string;
  readonly lines: readonly EntryLine[];
  readonly total: Money;
  readonly createdAt: Date;
};

export type EntryDraft = {
  readonly entryDate: string;
  readonly memo: string;
  readonly lines: readonly {
    readonly account: string;
    readonly side: Side;
    readonly amount: Money;
  }[];
};

export type EntryStamp = {
  readonly id: EntryId;
  readonly createdAt: Date;
};

const invalid = (message: string): Err<DomainError> =>
  err(domainError('INVALID_INPUT', message));

export function makeEntry(
  draft: EntryDraft,
  stamp: EntryStamp,
  names: AccountNames,
): Result<Entry, DomainError> {
  const memo = draft.memo.trim();
  const length = memoLength(memo);
  if (length === 0 || length > MEMO_MAX_LENGTH) {
    return invalid(`A memo must be 1 to ${String(MEMO_MAX_LENGTH)} characters once trimmed.`);
  }

  const lines = checkLines(draft.lines, names);
  if (!lines.ok) {
    return lines;
  }

  const total = balancedTotal(lines.value);
  if (!total.ok) {
    return total;
  }

  return ok({
    id: stamp.id,
    entryDate: draft.entryDate,
    memo,
    lines: lines.value,
    total: total.value,
    createdAt: stamp.createdAt,
  });
}

export function makePostedEntry(
  draft: EntryDraft,
  stamp: EntryStamp,
  accounts: readonly Account[],
): Result<Entry, DomainError> {
  const entry = makeEntry(draft, stamp, accountNames(accounts));
  if (!entry.ok) {
    return entry;
  }
  const active = checkActiveOn(
    accounts,
    entry.value.entryDate,
    entry.value.lines.map((line) => line.account),
  );
  return active.ok ? entry : active;
}

function checkLines(
  drafts: EntryDraft['lines'],
  names: AccountNames,
): Result<readonly EntryLine[], DomainError> {
  if (drafts.length < 2) {
    return invalid('An entry needs two or more lines.');
  }

  const lines: EntryLine[] = [];
  for (const line of drafts) {
    const account = names.get(line.account);
    if (account === undefined) {
      return invalid(`Account "${line.account}" is not in the User's chart of accounts.`);
    }
    if (moneyToMinorUnits(line.amount) <= 0) {
      return invalid('Every line needs an amount greater than zero.');
    }
    lines.push({
      account: account.id,
      accountName: account.name,
      side: line.side,
      amount: line.amount,
    });
  }
  return ok(lines);
}

function balancedTotal(lines: readonly EntryLine[]): Result<Money, DomainError> {
  const debits = lines.filter((line) => line.side === 'debit').map((line) => line.amount);
  const credits = lines.filter((line) => line.side === 'credit').map((line) => line.amount);
  if (debits.length === 0 || credits.length === 0) {
    return invalid('An entry needs at least one debit and one credit.');
  }

  const debitTotal = sumMoney(debits);
  if (!debitTotal.ok) {
    return invalid('The debits add up to more than an amount can hold.');
  }
  const creditTotal = sumMoney(credits);
  if (!creditTotal.ok) {
    return invalid('The credits add up to more than an amount can hold.');
  }

  if (debitTotal.value !== creditTotal.value) {
    return err(domainError('UNBALANCED', 'The debits and the credits differ.'));
  }
  return ok(debitTotal.value);
}
