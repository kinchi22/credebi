import { accountTypeSchema, type AccountId, type AccountType } from '@repo/contracts';

export const ACCOUNT_TYPES: readonly AccountType[] = accountTypeSchema.options;

export type Account = {
  readonly id: AccountId;
  readonly accountType: AccountType;
  readonly name: string;
  readonly description: string | null;
  readonly position: number;
  readonly activeFrom: string;
  readonly activeUntil: string | null;
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

export function startingChart(
  startsOn: string,
  newAccountId: () => AccountId,
): readonly Account[] {
  return STARTING_ACCOUNTS.map(({ accountType, name }) => ({
    id: newAccountId(),
    accountType,
    name,
    description: null,
    position: 0,
    activeFrom: startsOn,
    activeUntil: null,
  }));
}

export function chartInOrder(accounts: readonly Account[]): readonly Account[] {
  return [...accounts].sort(
    (first, second) =>
      ACCOUNT_TYPES.indexOf(first.accountType) - ACCOUNT_TYPES.indexOf(second.accountType) ||
      first.position - second.position,
  );
}

export function accountNames(accounts: readonly Account[]): AccountNames {
  return new Map(accounts.map(({ id, name }) => [id, { id, name }]));
}
