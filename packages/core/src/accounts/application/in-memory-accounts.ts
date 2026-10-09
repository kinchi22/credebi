import { ok, type UserId } from '@repo/contracts';
import { type Account } from '../domain/account';
import { type AccountRepository } from '../ports/account-repository';

export type InMemoryAccounts = {
  readonly accounts: AccountRepository;
  readonly hold: (userId: UserId, chart: readonly Account[]) => void;
};

export function inMemoryAccounts(): InMemoryAccounts {
  const charts = new Map<UserId, readonly Account[]>();
  return {
    accounts: {
      readChart: (userId) => Promise.resolve(ok(charts.get(userId) ?? [])),
    },
    hold: (userId, chart) => {
      charts.set(userId, chart);
    },
  };
}
