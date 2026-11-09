export { SIGNED_OUT, requireUser } from './domain/auth-context';
export type { AuthContext } from './domain/auth-context';

export { SESSION_LIFETIME_DAYS, assessSession, sessionExpiry } from './domain/session';
export type {
  Session,
  SessionState,
  SessionToken,
  SessionTokenHash,
  StoredSession,
} from './domain/session';

export { TEST_EMAIL_DOMAIN, googleSignIn, testSignIn } from './domain/user';
export type {
  GoogleClaims,
  Identity,
  IdentityProvider,
  Profile,
  SignInClaims,
  User,
} from './domain/user';

export type { ClientDocument } from './domain/client-document';

export { AUTHORIZATION_CODE_SECONDS } from './domain/authorization';
export type {
  ApprovedRequest,
  AuthorizationCode,
  AuthorizationCodeHash,
  AuthorizationServer,
  CodeExchange,
  IssuedAuthorizationCode,
} from './domain/authorization';

export {
  ACCESS_TOKEN_SECONDS,
  CONNECTION_IDLE_DAYS,
  REFRESH_TOKEN_DAYS,
  redirectHostOf,
} from './domain/connection';
export type {
  AccessGrant,
  AccessToken,
  AccessTokenHash,
  Connection,
  IssuedTokens,
  RefreshRotation,
  RefreshSuccessor,
  RefreshToken,
  RefreshTokenHash,
  RotationOutcome,
  StoredAccessToken,
  StoredRefreshToken,
} from './domain/connection';

export { createExchangeCode } from './application/exchange-code';
export type { ExchangeCode, ExchangeCodeDependencies } from './application/exchange-code';

export type {
  GrantedTokens,
  IssuedCredentials,
  TokenIssuer,
  TokenOutcome,
} from './application/issue-tokens';

export { createRefreshAccessToken } from './application/refresh-access-token';
export type {
  RefreshAccessToken,
  RefreshAccessTokenDependencies,
  RefreshGrant,
} from './application/refresh-access-token';

export { createListConnections } from './application/list-connections';
export type { ListConnections, ListConnectionsDependencies } from './application/list-connections';

export { createRevokeConnection } from './application/revoke-connection';
export type {
  RevokeConnection,
  RevokeConnectionDependencies,
} from './application/revoke-connection';

export { createResolveAccessToken } from './application/resolve-access-token';
export type {
  ResolveAccessToken,
  ResolveAccessTokenDependencies,
} from './application/resolve-access-token';

export {
  createApproveAuthorization,
  createBeginAuthorization,
  createDenyAuthorization,
} from './application/authorize';
export type {
  ApproveAuthorization,
  ApproveAuthorizationDependencies,
  AuthorizationOutcome,
  BeginAuthorization,
  BeginAuthorizationDependencies,
  ConsentRequest,
  DenyAuthorization,
} from './application/authorize';

export { createFinishGoogleSignIn, createTestSignIn } from './application/sign-in';
export type {
  FinishGoogleSignIn,
  IssuedSession,
  SignInDependencies,
  TestSignIn,
} from './application/sign-in';

export { createBeginGoogleSignIn } from './application/begin-google-sign-in';
export type {
  BeginGoogleSignIn,
  BeginGoogleSignInDependencies,
} from './application/begin-google-sign-in';

export { createResolveSession } from './application/resolve-session';
export type { ResolveSession, ResolveSessionDependencies } from './application/resolve-session';

export { createSignOut } from './application/sign-out';
export type { SignOut, SignOutDependencies } from './application/sign-out';

export type { AuthorizationCodeRepository } from './ports/authorization-code-repository';
export type { ClientDocuments } from './ports/client-documents';
export type { ConnectionRepository } from './ports/connection-repository';
export type { GoogleSignIn, PendingSignIn } from './ports/google-sign-in';
export type { SessionRepository } from './ports/session-repository';
export type { UserRepository } from './ports/user-repository';
