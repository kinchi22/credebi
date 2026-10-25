import {
  ok,
  type AccountGroupId,
  type AccountId,
  type AccountType,
  type DomainError,
  type Money,
  type Result,
} from '@repo/contracts';
import { type Account, type ChartNode } from '../../accounts/domain/account';
import { balanceDirection } from '../../accounts/domain/balance-direction';
import { addMoney, MONEY_ZERO, negateMoney, sumMoney } from '../../money/domain/money';

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

export type SectionScope = {
  readonly accountType: AccountType;
  readonly includes: (account: Account, named: AccountSums | undefined) => boolean;
  readonly sums: ReadonlyMap<AccountId, AccountSums>;
};

const NO_SUMS = { debit: MONEY_ZERO, credit: MONEY_ZERO };

function balanceOf(
  accountType: AccountType,
  { debit, credit }: Pick<AccountSums, 'debit' | 'credit'>,
): Result<Money, DomainError> {
  return balanceDirection(accountType, 'debit') === 'increase'
    ? addMoney(debit, negateMoney(credit))
    : addMoney(credit, negateMoney(debit));
}

function accountRows(
  accounts: readonly Account[],
  { accountType, includes, sums }: SectionScope,
): Result<StatementAccount[], DomainError> {
  const rows: StatementAccount[] = [];
  for (const account of accounts) {
    const named = sums.get(account.id);
    if (account.accountType === accountType && includes(account, named)) {
      const total = balanceOf(accountType, named ?? NO_SUMS);
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

export function statementSection(
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
  const total = sumMoney(rows.map((row) => row.total));
  return total.ok ? ok({ total: total.value, rows }) : total;
}

export function sumsByAccount(sums: readonly AccountSums[]): ReadonlyMap<AccountId, AccountSums> {
  return new Map(sums.map((named) => [named.account, named]));
}
