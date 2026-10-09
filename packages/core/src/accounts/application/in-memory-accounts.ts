import { ok, type AccountId, type UserId } from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from '../domain/account';
import { type AccountRepository } from '../ports/account-repository';

export type InMemoryAccounts = {
  readonly accounts: AccountRepository;
  readonly hold: (
    userId: UserId,
    accounts: readonly Account[],
    groups?: readonly AccountGroup[],
  ) => void;
  readonly nameInEntry: (accountId: AccountId) => void;
};

const EMPTY: Chart = { accounts: [], groups: [] };

const replaced = <Node extends { readonly id: string }>(
  nodes: readonly Node[],
  node: Node,
): readonly Node[] => nodes.map((held) => (held.id === node.id ? node : held));

export function inMemoryAccounts(): InMemoryAccounts {
  const charts = new Map<UserId, Chart>();
  const named = new Set<AccountId>();
  const chartOf = (userId: UserId): Chart => charts.get(userId) ?? EMPTY;
  const change = (userId: UserId, changed: (chart: Chart) => Chart) => {
    charts.set(userId, changed(chartOf(userId)));
    return Promise.resolve(ok(undefined));
  };

  return {
    accounts: {
      readChart: (userId) => Promise.resolve(ok(chartOf(userId))),
      addAccount: (userId, account) =>
        change(userId, (chart) => ({ ...chart, accounts: [...chart.accounts, account] })),
      updateAccount: (userId, account) =>
        change(userId, (chart) => ({ ...chart, accounts: replaced(chart.accounts, account) })),
      addGroup: (userId, group) =>
        change(userId, (chart) => ({ ...chart, groups: [...chart.groups, group] })),
      updateGroup: (userId, group) =>
        change(userId, (chart) => ({ ...chart, groups: replaced(chart.groups, group) })),
      isAccountNamed: (userId, id) =>
        Promise.resolve(
          ok(named.has(id) && chartOf(userId).accounts.some((account) => account.id === id)),
        ),
      deleteAccount: (userId, id) =>
        change(userId, (chart) => ({
          ...chart,
          accounts: chart.accounts.filter((account) => account.id !== id),
        })),
      deleteGroup: (userId, id) =>
        change(userId, (chart) => ({
          ...chart,
          groups: chart.groups.filter((group) => group.id !== id),
        })),
    },
    hold: (userId, accounts, groups = []) => {
      charts.set(userId, { accounts, groups });
    },
    nameInEntry: (accountId) => {
      named.add(accountId);
    },
  };
}
