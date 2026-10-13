import { type DomainError, ok, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { offeredSince, offeredTitles, type OfferedTitle } from '../domain/offered-titles';
import { type EntryRepository } from '../ports/entry-repository';

export type GetTitlesDependencies = {
  readonly entries: EntryRepository;
  readonly now: () => Date;
};

export type GetTitles = (
  auth: AuthContext,
) => Promise<Result<readonly OfferedTitle[], DomainError>>;

export function createGetTitles({ entries, now }: GetTitlesDependencies): GetTitles {
  return async (auth) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }
    const titled = await entries.titledEntries(userId.value, offeredSince(now()));
    return titled.ok ? ok(offeredTitles(titled.value)) : titled;
  };
}
