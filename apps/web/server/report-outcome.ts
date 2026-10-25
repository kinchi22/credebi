import { type DomainErrorCode } from '@repo/contracts';
import { fromTrpcError } from './domain-error';

export type Unanswered = 'refused' | 'unavailable';

const UNANSWERED: Partial<Record<DomainErrorCode, Unanswered>> = {
  INVALID_INPUT: 'refused',
  DEPENDENCY_UNAVAILABLE: 'unavailable',
};

export function unanswered(thrown: unknown): Unanswered {
  const outcome = UNANSWERED[fromTrpcError(thrown).code];
  if (outcome === undefined) {
    throw thrown;
  }
  return outcome;
}
