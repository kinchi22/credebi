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
  IssuedAuthorizationCode,
} from './domain/authorization';

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
export type { GoogleSignIn, PendingSignIn } from './ports/google-sign-in';
export type { SessionRepository } from './ports/session-repository';
export type { UserRepository } from './ports/user-repository';
