import { ok, type AccountId, type UserId } from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from '../domain/account';
import { type ShownSpan } from '../domain/active-period';
import { type AccountRepository } from '../ports/account-repository';

export type InMemoryAccounts = {
  readonly accounts: AccountRepository;
  readonly hold: (
    userId: UserId,
    accounts: readonly Account[],
    groups?: readonly AccountGroup[],
  ) => void;
  readonly nameInEntry: (accountId: AccountId) => void;
  readonly showInEntry: (accountId: AccountId, day: string) => void;
};

const EMPTY: Chart = { accounts: [], groups: [] };

const replaced = <Node extends { readonly id: string }>(
  nodes: readonly Node[],
  node: Node,
): readonly Node[] => nodes.map((held) => (held.id === node.id ? node : held));

export function inMemoryAccounts(): InMemoryAccounts {
  const charts = new Map<UserId, Chart>();
  const named = new Set<AccountId>();
  const shown = new Map<AccountId, ShownSpan>();
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
      readShownSpan: (userId, id) =>
        Promise.resolve(
          ok(
            chartOf(userId).accounts.some((account) => account.id === id)
              ? (shown.get(id) ?? null)
              : null,
          ),
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
    showInEntry: (accountId, day) => {
      named.add(accountId);
      const span = shown.get(accountId);
      shown.set(accountId, {
        first: span === undefined || day < span.first ? day : span.first,
        last: span === undefined || day > span.last ? day : span.last,
      });
    },
  };
}
