import { type DomainError, type Result, type UserId } from '@repo/contracts';
import { type Account } from '../domain/account';

export type AccountRepository = {
  readonly readChart: (userId: UserId) => Promise<Result<readonly Account[], DomainError>>;
  readonly addAccount: (userId: UserId, account: Account) => Promise<Result<void, DomainError>>;
  readonly updateAccount: (userId: UserId, account: Account) => Promise<Result<void, DomainError>>;
};
