import { type DomainError, type Result } from '@repo/contracts';
import { type EntryRepository } from './entry-repository';
import { type RequestKeyRepository } from './request-key-repository';

export type TransactionalWork<T> = (
  entries: EntryRepository,
  requestKeys: RequestKeyRepository,
) => Promise<Result<T, DomainError>>;

export type UnitOfWork = {
  readonly run: <T>(work: TransactionalWork<T>) => Promise<Result<T, DomainError>>;
};
