import {
  accountTypeSchema,
  domainError,
  err,
  ok,
  type AccountGroupId,
  type AccountId,
  type AccountType,
  type DomainError,
  type Result,
} from '@repo/contracts';

export const ACCOUNT_TYPES: readonly AccountType[] = accountTypeSchema.options;

export type Account = {
  readonly id: AccountId;
  readonly accountType: AccountType;
  readonly groupId: AccountGroupId | null;
  readonly name: string;
  readonly description: string | null;
  readonly position: number;
  readonly activeFrom: string;
  readonly activeUntil: string | null;
};

export type AccountGroup = {
  readonly id: AccountGroupId;
  readonly accountType: AccountType;
  readonly name: string;
  readonly description: string | null;
  readonly position: number;
};

export type Chart = {
  readonly accounts: readonly Account[];
  readonly groups: readonly AccountGroup[];
};

export type ChartNode =
  | { readonly kind: 'account'; readonly account: Account }
  | {
      readonly kind: 'group';
      readonly group: AccountGroup;
      readonly accounts: readonly Account[];
    };

export type NamedAccount = {
  readonly id: AccountId;
  readonly name: string;
};

export type AccountNames = ReadonlyMap<string, NamedAccount>;

export const STARTING_ACCOUNTS: readonly {
  readonly accountType: AccountType;
  readonly name: string;
}[] = [
  { accountType: 'asset', name: 'Cash' },
  { accountType: 'liability', name: 'Accounts payable' },
  { accountType: 'equity', name: 'Capital' },
  { accountType: 'revenue', name: 'Sales' },
  { accountType: 'expense', name: 'Expenses' },
];

export function dayOf(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

export function parseDay(text: string): Result<string, DomainError> {
  const midnight = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(midnight.getTime()) && dayOf(midnight) === text
    ? ok(text)
    : err(domainError('INVALID_INPUT', `"${text}" is not a day.`));
}

export function startingChart(
  startsOn: string,
  newAccountId: () => AccountId,
): readonly Account[] {
  return STARTING_ACCOUNTS.map(({ accountType, name }) => ({
    id: newAccountId(),
    accountType,
    groupId: null,
    name,
    description: null,
    position: 0,
    activeFrom: startsOn,
    activeUntil: null,
  }));
}

const byPosition = <Placed extends { readonly position: number }>(
  placed: readonly Placed[],
): Placed[] => [...placed].sort((first, second) => first.position - second.position);

export function chartInOrder({ accounts, groups }: Chart): readonly ChartNode[] {
  const accountsOf = (groupId: AccountGroupId | null): readonly Account[] =>
    accounts.filter((account) => account.groupId === groupId);

  return ACCOUNT_TYPES.flatMap((accountType) => {
    const placed: { readonly position: number; readonly node: ChartNode }[] = [
      ...groups
        .filter((group) => group.accountType === accountType)
        .map((group) => ({
          position: group.position,
          node: { kind: 'group' as const, group, accounts: byPosition(accountsOf(group.id)) },
        })),
      ...accountsOf(null)
        .filter((account) => account.accountType === accountType)
        .map((account) => ({ position: account.position, node: { kind: 'account' as const, account } })),
    ];
    return byPosition(placed).map(({ node }) => node);
  });
}

export function accountNames(accounts: readonly Account[]): AccountNames {
  return new Map(accounts.map(({ id, name }) => [id, { id, name }]));
}

export function findAccount(chart: Chart, id: AccountId): Result<Account, DomainError> {
  const account = chart.accounts.find((candidate) => candidate.id === id);
  return account === undefined
    ? err(domainError('NOT_FOUND', `Account ${id} is not in the User's chart of accounts.`))
    : ok(account);
}

export function findGroup(chart: Chart, id: AccountGroupId): Result<AccountGroup, DomainError> {
  const group = chart.groups.find((candidate) => candidate.id === id);
  return group === undefined
    ? err(domainError('NOT_FOUND', `Account group ${id} is not in the User's chart of accounts.`))
    : ok(group);
}
