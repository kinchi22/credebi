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
  readonly netIncome: Money;
};

type StatementType = Extract<AccountType, 'revenue' | 'expense'>;

const NO_SUMS = { debit: MONEY_ZERO, credit: MONEY_ZERO };

const TOTAL_BY_TYPE: Readonly<
  Record<StatementType, (sums: Pick<AccountSums, 'debit' | 'credit'>) => Result<Money, DomainError>>
> = {
  revenue: ({ debit, credit }) => addMoney(credit, negateMoney(debit)),
  expense: ({ debit, credit }) => addMoney(debit, negateMoney(credit)),
};

type SectionScope = {
  readonly accountType: StatementType;
  readonly range: DayRange;
  readonly sums: ReadonlyMap<AccountId, AccountSums>;
};

function accountRows(
  accounts: readonly Account[],
  { accountType, range, sums }: SectionScope,
): Result<StatementAccount[], DomainError> {
  const rows: StatementAccount[] = [];
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
      rows.push({ kind: 'account', account: account.id, name: account.name, total: total.value });
    }
  }
  return ok(rows);
}

function rowsOf(node: ChartNode, scope: SectionScope): Result<StatementRow[], DomainError> {
  if (node.kind === 'account') {
    return accountRows([node.account], scope);
  }
  const accounts = accountRows(node.accounts, scope);
  if (!accounts.ok || accounts.value.length === 0) {
    return accounts;
  }
  const subtotal = sumMoney(accounts.value.map((row) => row.total));
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
  scope: SectionScope,
): Result<StatementSection, DomainError> {
  const rows: StatementRow[] = [];
  for (const node of chart) {
    const nodeRows = rowsOf(node, scope);
    if (!nodeRows.ok) {
      return nodeRows;
    }
    rows.push(...nodeRows.value);
  }
  const total = sumMoney(
    rows.flatMap((row) => (row.kind === 'group' ? row.accounts : [row])).map(
      (row) => row.total,
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
  const netIncome = addMoney(revenue.value.total, negateMoney(expense.value.total));
  return netIncome.ok
    ? ok({ revenue: revenue.value, expense: expense.value, netIncome: netIncome.value })
    : netIncome;
}
