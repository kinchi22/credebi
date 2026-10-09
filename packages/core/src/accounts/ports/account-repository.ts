import { type DomainError, type Result, type UserId } from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from '../domain/account';

export type AccountRepository = {
  readonly readChart: (userId: UserId) => Promise<Result<Chart, DomainError>>;
  readonly addAccount: (userId: UserId, account: Account) => Promise<Result<void, DomainError>>;
  readonly updateAccount: (userId: UserId, account: Account) => Promise<Result<void, DomainError>>;
  readonly addGroup: (userId: UserId, group: AccountGroup) => Promise<Result<void, DomainError>>;
  readonly updateGroup: (userId: UserId, group: AccountGroup) => Promise<Result<void, DomainError>>;
};
