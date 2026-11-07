import {
  type ConnectionId,
  type DomainError,
  type EntryId,
  type Result,
  type UserId,
} from '@repo/contracts';

export type RecordedRequestKey = {
  readonly requestKey: string;
  readonly entryId: EntryId;
  readonly connectionId: ConnectionId | undefined;
};

export type RequestKeyRepository = {
  readonly find: (
    userId: UserId,
    requestKey: string,
  ) => Promise<Result<EntryId | undefined, DomainError>>;
  readonly record: (
    userId: UserId,
    recorded: RecordedRequestKey,
  ) => Promise<Result<void, DomainError>>;
};
