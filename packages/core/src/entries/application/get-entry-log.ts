import { type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../../auth/domain/auth-context';
import { type Entry } from '../domain/entry';
import { type EntryRepository } from '../ports/entry-repository';

export type GetEntryLogDependencies = {
  readonly entries: EntryRepository;
};

export type GetEntryLog = (auth: AuthContext) => Promise<Result<readonly Entry[], DomainError>>;

export function createGetEntryLog({ entries }: GetEntryLogDependencies): GetEntryLog {
  return (auth) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return Promise.resolve(userId);
    }
    return entries.entryLog(userId.value);
  };
}
