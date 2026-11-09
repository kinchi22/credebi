import { type ConnectionId, type DomainError, type Result } from '@repo/contracts';
import { requireUser, type AuthContext } from '../domain/auth-context';
import { type ConnectionRepository } from '../ports/connection-repository';

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

    return connections.revokeOwnedBy(userId.value, connectionId);
  };
}
