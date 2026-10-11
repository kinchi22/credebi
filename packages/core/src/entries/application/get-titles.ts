import { type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type EntryRepository } from '../ports/entry-repository';

export type GetTitlesDependencies = {
  readonly entries: EntryRepository;
};

export type GetTitles = (auth: AuthContext) => Promise<Result<readonly string[], DomainError>>;

export function createGetTitles({ entries }: GetTitlesDependencies): GetTitles {
  return async (auth) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }
    return entries.titles(userId.value);
  };
}
