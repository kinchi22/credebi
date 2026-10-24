import { type DomainError, type EntryId, type Result, type UserId } from '@repo/contracts';
import { type Entry } from '../domain/entry';
import { type AccountSums } from '../domain/income-statement';
import { type TitledEntry } from '../domain/offered-titles';
import { type Reversal } from '../domain/reversal';
import { type SearchCriteria } from '../domain/search-criteria';
import { type DayRange } from '../domain/search-range';

export type FoundEntry = {
  readonly entry: Entry;
  readonly reversed: boolean;
};

export type EntryRepository = {
  readonly save: (userId: UserId, entry: Entry) => Promise<Result<void, DomainError>>;
  readonly saveReversal: (
    userId: UserId,
    reversal: Reversal,
  ) => Promise<Result<void, DomainError>>;
  readonly find: (userId: UserId, id: EntryId) => Promise<Result<FoundEntry, DomainError>>;
  readonly search: (
    userId: UserId,
    criteria: SearchCriteria,
  ) => Promise<Result<readonly Entry[], DomainError>>;
  readonly accountTotals: (
    userId: UserId,
    range: DayRange,
  ) => Promise<Result<readonly AccountSums[], DomainError>>;
  readonly titledEntries: (
    userId: UserId,
    createdSince: Date,
  ) => Promise<Result<readonly TitledEntry[], DomainError>>;
};
