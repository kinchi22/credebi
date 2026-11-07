import {
  ok,
  type ConnectionId,
  type DomainError,
  type Result,
} from '@repo/contracts';
import {
  codeRedeemable,
  type AuthorizationCodeHash,
  type CodeExchange,
} from '../domain/authorization';
import { connectionFrom } from '../domain/connection';
import { type AuthorizationCodeRepository } from '../ports/authorization-code-repository';
import { type ConnectionRepository } from '../ports/connection-repository';
import {
  granted,
  issueTokens,
  REFUSED,
  type TokenIssuer,
  type TokenOutcome,
} from './issue-tokens';

export type ExchangeCodeDependencies = TokenIssuer & {
  readonly codes: AuthorizationCodeRepository;
  readonly connections: ConnectionRepository;
  readonly hashAuthorizationCode: (code: string) => AuthorizationCodeHash;
  readonly pkceChallengeOf: (verifier: string) => string;
  readonly newConnectionId: () => ConnectionId;
  readonly now: () => Date;
};

export type ExchangeCode = (exchange: CodeExchange) => Promise<Result<TokenOutcome, DomainError>>;

export function createExchangeCode(dependencies: ExchangeCodeDependencies): ExchangeCode {
  const { codes, connections, hashAuthorizationCode, pkceChallengeOf, now } = dependencies;
  return async (exchange) => {
    const taken = await codes.take(hashAuthorizationCode(exchange.code));
    if (!taken.ok) {
      return taken;
    }
    const issuedAt = now();
    const code = taken.value;
    const presented = { ...exchange, verifierChallenge: pkceChallengeOf(exchange.codeVerifier) };
    if (code === undefined || !codeRedeemable(code, presented, issuedAt)) {
      return ok(REFUSED);
    }
    const credentials = issueTokens(dependencies, issuedAt);
    const opened = await connections.open(
      connectionFrom(code, dependencies.newConnectionId(), issuedAt),
      credentials.issued,
    );
    return opened.ok ? ok(granted(credentials, code.scopes)) : opened;
  };
}
