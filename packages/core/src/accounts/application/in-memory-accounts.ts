import { ok, type UserId } from '@repo/contracts';
import { type Account } from '../domain/account';
import { type AccountRepository } from '../ports/account-repository';

export type InMemoryAccounts = {
  readonly accounts: AccountRepository;
  readonly hold: (userId: UserId, chart: readonly Account[]) => void;
};

export function inMemoryAccounts(): InMemoryAccounts {
  const charts = new Map<UserId, readonly Account[]>();
  const chartOf = (userId: UserId): readonly Account[] => charts.get(userId) ?? [];
  return {
    accounts: {
      readChart: (userId) => Promise.resolve(ok(chartOf(userId))),
      addAccount: (userId, account) => {
        charts.set(userId, [...chartOf(userId), account]);
        return Promise.resolve(ok(undefined));
      },
      updateAccount: (userId, account) => {
        charts.set(
          userId,
          chartOf(userId).map((held) => (held.id === account.id ? account : held)),
        );
        return Promise.resolve(ok(undefined));
      },
    },
    hold: (userId, chart) => {
      charts.set(userId, chart);
    },
  };
}
