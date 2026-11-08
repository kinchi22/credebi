import { type ConnectionId, type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../domain/auth-context';
import { lapseCutoff, type Connection } from '../domain/connection';
import { type ConnectionRepository } from '../ports/connection-repository';

export type ListConnectionsDependencies = {
  readonly connections: ConnectionRepository;
  readonly now: () => Date;
};

export type ListConnections = (
  auth: AuthContext,
) => Promise<Result<readonly Connection[], DomainError>>;

export function createListConnections({
  connections,
  now,
}: ListConnectionsDependencies): ListConnections {
  return async (auth) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    return connections.listOf(userId.value, lapseCutoff(now()));
  };
}

export type RevokeConnectionDependencies = {
  readonly connections: ConnectionRepository;
};

export type RevokeConnection = (
  auth: AuthContext,
  connectionId: ConnectionId,
) => Promise<Result<void, DomainError>>;

export function createRevokeConnection({
  connections,
}: RevokeConnectionDependencies): RevokeConnection {
  return async (auth, connectionId) => {
    const userId = requireUser(auth);
    if (!userId.ok) {
      return userId;
    }

    return connections.revokeOf(userId.value, connectionId);
  };
}
