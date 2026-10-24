import {
  ok,
  type AccountGroupId,
  type AccountId,
  type AccountType,
  type DomainError,
  type Money,
  type Result,
} from '@repo/contracts';
import {
  chartInOrder,
  type Account,
  type Chart,
  type ChartNode,
} from '../../accounts/domain/account';
import { isActiveWithin } from '../../accounts/domain/active-period';
import { addMoney, MONEY_ZERO, negateMoney, sumMoney } from '../../money/domain/money';
import { type DayRange } from './search-range';

export type AccountSums = {
  readonly account: AccountId;
  readonly debit: Money;
  readonly credit: Money;
};

export type StatementAccount = {
  readonly kind: 'account';
  readonly account: AccountId;
  readonly name: string;
  readonly total: Money;
};

export type StatementGroup = {
  readonly kind: 'group';
  readonly group: AccountGroupId;
  readonly name: string;
  readonly total: Money;
  readonly accounts: readonly StatementAccount[];
};

export type StatementRow = StatementAccount | StatementGroup;

export type StatementSection = {
  readonly total: Money;
  readonly rows: readonly StatementRow[];
};

export type IncomeStatement = {
  readonly revenue: StatementSection;
  readonly expense: StatementSection;
  readonly difference: Money;
};

type StatementType = Extract<AccountType, 'revenue' | 'expense'>;

const NO_SUMS = { debit: MONEY_ZERO, credit: MONEY_ZERO };

const TOTAL_BY_TYPE: Readonly<
  Record<StatementType, (sums: Pick<AccountSums, 'debit' | 'credit'>) => Result<Money, DomainError>>
> = {
  revenue: ({ debit, credit }) => addMoney(credit, negateMoney(debit)),
  expense: ({ debit, credit }) => addMoney(debit, negateMoney(credit)),
};

type Listing = {
  readonly accountType: StatementType;
  readonly range: DayRange;
  readonly sums: ReadonlyMap<AccountId, AccountSums>;
};

function listedAccounts(
  accounts: readonly Account[],
  { accountType, range, sums }: Listing,
): Result<StatementAccount[], DomainError> {
  const listed: StatementAccount[] = [];
  for (const account of accounts) {
    const named = sums.get(account.id);
    if (
      account.accountType === accountType &&
      (named !== undefined || isActiveWithin(account, range))
    ) {
      const total = TOTAL_BY_TYPE[accountType](named ?? NO_SUMS);
      if (!total.ok) {
        return total;
      }
      listed.push({ kind: 'account', account: account.id, name: account.name, total: total.value });
    }
  }
  return ok(listed);
}

function rowsOf(node: ChartNode, listing: Listing): Result<StatementRow[], DomainError> {
  if (node.kind === 'account') {
    return listedAccounts([node.account], listing);
  }
  const accounts = listedAccounts(node.accounts, listing);
  if (!accounts.ok || accounts.value.length === 0) {
    return accounts;
  }
  const subtotal = sumMoney(accounts.value.map((listed) => listed.total));
  return subtotal.ok
    ? ok([
        {
          kind: 'group',
          group: node.group.id,
          name: node.group.name,
          total: subtotal.value,
          accounts: accounts.value,
        },
      ])
    : subtotal;
}

function section(
  chart: readonly ChartNode[],
  listing: Listing,
): Result<StatementSection, DomainError> {
  const rows: StatementRow[] = [];
  for (const node of chart) {
    const listed = rowsOf(node, listing);
    if (!listed.ok) {
      return listed;
    }
    rows.push(...listed.value);
  }
  const total = sumMoney(
    rows.flatMap((listed) => (listed.kind === 'group' ? listed.accounts : [listed])).map(
      (listed) => listed.total,
    ),
  );
  return total.ok ? ok({ total: total.value, rows }) : total;
}

export function incomeStatement(
  chart: Chart,
  range: DayRange,
  sums: readonly AccountSums[],
): Result<IncomeStatement, DomainError> {
  const nodes = chartInOrder(chart);
  const byAccount = new Map(sums.map((named) => [named.account, named]));
  const revenue = section(nodes, { accountType: 'revenue', range, sums: byAccount });
  if (!revenue.ok) {
    return revenue;
  }
  const expense = section(nodes, { accountType: 'expense', range, sums: byAccount });
  if (!expense.ok) {
    return expense;
  }
  const difference = addMoney(revenue.value.total, negateMoney(expense.value.total));
  return difference.ok
    ? ok({ revenue: revenue.value, expense: expense.value, difference: difference.value })
    : difference;
}
