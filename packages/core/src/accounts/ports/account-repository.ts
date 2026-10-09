import {
  type AccountGroupId,
  type AccountId,
  type DomainError,
  type Result,
  type UserId,
} from '@repo/contracts';
import { type Account, type AccountGroup, type Chart } from '../domain/account';
import { type ShownSpan } from '../domain/active-period';

export type AccountRepository = {
  readonly readChart: (userId: UserId) => Promise<Result<Chart, DomainError>>;
  readonly addAccount: (userId: UserId, account: Account) => Promise<Result<void, DomainError>>;
  readonly updateAccount: (userId: UserId, account: Account) => Promise<Result<void, DomainError>>;
  readonly addGroup: (userId: UserId, group: AccountGroup) => Promise<Result<void, DomainError>>;
  readonly updateGroup: (userId: UserId, group: AccountGroup) => Promise<Result<void, DomainError>>;
  readonly isAccountNamed: (userId: UserId, id: AccountId) => Promise<Result<boolean, DomainError>>;
  readonly readShownSpan: (
    userId: UserId,
    id: AccountId,
  ) => Promise<Result<ShownSpan | null, DomainError>>;
  readonly deleteAccount: (userId: UserId, id: AccountId) => Promise<Result<void, DomainError>>;
  readonly deleteGroup: (userId: UserId, id: AccountGroupId) => Promise<Result<void, DomainError>>;
};
