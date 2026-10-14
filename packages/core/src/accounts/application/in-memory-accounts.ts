import { domainError, err, ok, type AccountId, type UserId } from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from '../domain/account';
import { type ShownSpan } from '../domain/active-period';
import { type AccountRemoval } from '../domain/removal';
import { type AccountRepository } from '../ports/account-repository';

export type InMemoryAccounts = {
  readonly accounts: AccountRepository;
  readonly hold: (
    userId: UserId,
    accounts: readonly Account[],
    groups?: readonly AccountGroup[],
  ) => void;
  readonly hideInEntry: (accountId: AccountId) => void;
  readonly showInEntry: (accountId: AccountId, day: string) => void;
  readonly removedAt: (accountId: AccountId) => Date | undefined;
};

const EMPTY: Chart = { accounts: [], groups: [] };

const replaced = <Node extends { readonly id: string }>(
  nodes: readonly Node[],
  node: Node,
): readonly Node[] => nodes.map((held) => (held.id === node.id ? node : held));

export function inMemoryAccounts(): InMemoryAccounts {
  const charts = new Map<UserId, Chart>();
  const hidden = new Set<AccountId>();
  const shown = new Map<AccountId, ShownSpan>();
  const marks = new Map<AccountId, Date>();
  const chartOf = (userId: UserId): Chart => charts.get(userId) ?? EMPTY;
  const holds = (userId: UserId, id: AccountId): boolean =>
    chartOf(userId).accounts.some((account) => account.id === id);
  const removal = (id: AccountId): AccountRemoval => {
    if (shown.has(id)) {
      return 'refused';
    }
    return hidden.has(id) ? 'marked' : 'deleted';
  };
  const change = (userId: UserId, changed: (chart: Chart) => Chart) => {
    charts.set(userId, changed(chartOf(userId)));
    return Promise.resolve(ok(undefined));
  };
  const without = (userId: UserId, id: AccountId) =>
    change(userId, (chart) => ({
      ...chart,
      accounts: chart.accounts.filter((account) => account.id !== id),
    }));

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
      placeNodes: (userId, placed) =>
        change(userId, (chart) => ({
          accounts: placed.accounts.reduce(replaced, chart.accounts),
          groups: placed.groups.reduce(replaced, chart.groups),
        })),
      readShownSpan: (userId, id) =>
        Promise.resolve(ok(holds(userId, id) ? (shown.get(id) ?? null) : null)),
      removeAccount: async (userId, id, removedAt) => {
        if (!holds(userId, id)) {
          return err(domainError('NOT_FOUND', `Account ${id} is not in the User's chart of accounts.`));
        }
        const removed = removal(id);
        if (removed === 'marked') {
          marks.set(id, removedAt);
        }
        if (removed !== 'refused') {
          await without(userId, id);
        }
        return ok(removed);
      },
      deleteGroup: (userId, id) =>
        change(userId, (chart) => ({
          ...chart,
          groups: chart.groups.filter((group) => group.id !== id),
        })),
    },
    hold: (userId, accounts, groups = []) => {
      charts.set(userId, { accounts, groups });
    },
    hideInEntry: (accountId) => {
      hidden.add(accountId);
    },
    showInEntry: (accountId, day) => {
      const span = shown.get(accountId);
      shown.set(accountId, {
        first: span === undefined || day < span.first ? day : span.first,
        last: span === undefined || day > span.last ? day : span.last,
      });
    },
    removedAt: (accountId) => marks.get(accountId),
  };
}
