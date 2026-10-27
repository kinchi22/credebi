import { type DomainError, type Result, type UserId } from '@repo/contracts';
import { type Chart } from '../../accounts/domain/account';
import { type Settings } from '../../settings/domain/settings';
import { type Identity, type Profile, type User } from '../domain/user';

export type UserRepository = {
  readonly findByIdentity: (identity: Identity) => Promise<Result<User | undefined, DomainError>>;
  readonly add: (
    user: User,
    identity: Identity,
    chart: Chart,
    settings: Settings,
  ) => Promise<Result<void, DomainError>>;
  readonly updateProfile: (userId: UserId, profile: Profile) => Promise<Result<void, DomainError>>;
};
