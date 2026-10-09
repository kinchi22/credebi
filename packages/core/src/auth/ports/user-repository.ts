import { type DomainError, type Result, type UserId } from '@repo/contracts';
import { type Account } from '../../accounts/domain/account';
import { type Identity, type Profile, type User } from '../domain/user';

export type UserRepository = {
  readonly findByIdentity: (identity: Identity) => Promise<Result<User | undefined, DomainError>>;
  readonly add: (
    user: User,
    identity: Identity,
    chart: readonly Account[],
  ) => Promise<Result<void, DomainError>>;
  readonly updateProfile: (userId: UserId, profile: Profile) => Promise<Result<void, DomainError>>;
};
