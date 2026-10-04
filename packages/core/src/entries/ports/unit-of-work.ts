import { type DomainError, type Result } from '@repo/contracts';
import { type EntryRepository } from './entry-repository';

export type TransactionalWork<T> = (
  entries: EntryRepository,
) => Promise<Result<T, DomainError>>;

export type UnitOfWork = <T>(work: TransactionalWork<T>) => Promise<Result<T, DomainError>>;
