import { type DomainError, type Result } from '@repo/contracts';
import { type ClientDocument } from '../domain/client-document';

export type ClientDocuments = {
  readonly fetch: (clientId: string) => Promise<Result<ClientDocument, DomainError>>;
};
