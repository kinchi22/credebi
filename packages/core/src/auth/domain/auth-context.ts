import {
  domainError,
  err,
  ok,
  type ConnectionId,
  type DomainError,
  type Result,
  type Scope,
  type UserId,
} from '@repo/contracts';

export type AuthContext = {
  readonly userId: UserId | undefined;
  readonly scopes?: readonly Scope[];
  readonly connectionId?: ConnectionId;
};

export const SIGNED_OUT: AuthContext = { userId: undefined };

export function requireUser(auth: AuthContext): Result<UserId, DomainError> {
  return auth.userId === undefined
    ? err(domainError('UNAUTHENTICATED', 'This needs a signed-in User.'))
    : ok(auth.userId);
}
