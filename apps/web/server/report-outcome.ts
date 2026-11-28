import { type DomainErrorCode, type Result } from '@repo/contracts';
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

export type Shown<Answer extends { readonly outcome: string }> = Exclude<
  Answer,
  { readonly outcome: 'unavailable' }
>;

export function parsedOrEmpty<Value>(parsed: Result<Value, unknown>): Partial<Value> {
  return parsed.ok ? parsed.value : {};
}
