import {
  domainError,
  err,
  ok,
  type AccountId,
  type DomainError,
  type Result,
  type UserId,
} from '@repo/contracts';
import { dayOf, parseDay, startingChart } from '../../accounts/domain/account';
import { sessionExpiry, type SessionToken, type SessionTokenHash } from '../domain/session';
import { googleSignIn, testSignIn, type SignInClaims } from '../domain/user';
import { type GoogleSignIn, type PendingSignIn } from '../ports/google-sign-in';
import { type SessionRepository } from '../ports/session-repository';
import { type UserRepository } from '../ports/user-repository';

export type SignInDependencies = {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly newUserId: () => UserId;
  readonly newAccountId: () => AccountId;
  readonly newSessionToken: () => SessionToken;
  readonly hashSessionToken: (token: string) => SessionTokenHash;
  readonly now: () => Date;
};

export type IssuedSession = {
  readonly token: SessionToken;
  readonly expiresAt: Date;
};

export type TestSignIn = (
  identifier: string,
  accountsStartOn?: string,
) => Promise<Result<IssuedSession, DomainError>>;

export type FinishGoogleSignIn = (
  callbackUrl: URL,
  pending: PendingSignIn | undefined,
) => Promise<Result<IssuedSession, DomainError>>;

export function createTestSignIn(dependencies: SignInDependencies): TestSignIn {
  return async (identifier, accountsStartOn) => {
    const claims = testSignIn(identifier);
    if (!claims.ok) {
      return claims;
    }
    if (accountsStartOn === undefined) {
      return signIn(dependencies, claims.value, undefined);
    }
    const startsOn = parseDay(accountsStartOn);
    return startsOn.ok ? signIn(dependencies, claims.value, startsOn.value) : startsOn;
  };
}

export function createFinishGoogleSignIn(
  dependencies: SignInDependencies & { readonly google: GoogleSignIn },
): FinishGoogleSignIn {
  return async (callbackUrl, pending) => {
    if (pending === undefined) {
      return err(domainError('INVALID_INPUT', 'No sign-in with Google was begun here.'));
    }
    const answered = await dependencies.google.complete(callbackUrl, pending);
    if (!answered.ok) {
      return answered;
    }
    const claims = googleSignIn(answered.value);
    return claims.ok ? signIn(dependencies, claims.value, undefined) : claims;
  };
}

async function signIn(
  dependencies: SignInDependencies,
  claims: SignInClaims,
  accountsStartOn: string | undefined,
): Promise<Result<IssuedSession, DomainError>> {
  const userId = await findOrAddUser(dependencies, claims, accountsStartOn);
  if (!userId.ok) {
    return userId;
  }

  const { sessions, newSessionToken, hashSessionToken, now } = dependencies;
  const token = newSessionToken();
  const expiresAt = sessionExpiry(now());
  const added = await sessions.add({
    tokenHash: hashSessionToken(token),
    userId: userId.value,
    expiresAt,
  });
  return added.ok ? ok({ token, expiresAt }) : added;
}

async function findOrAddUser(
  { users, newUserId, newAccountId, now }: SignInDependencies,
  { identity, profile }: SignInClaims,
  accountsStartOn: string | undefined,
): Promise<Result<UserId, DomainError>> {
  const found = await users.findByIdentity(identity);
  if (!found.ok) {
    return found;
  }
  if (found.value !== undefined) {
    const userId = found.value.id;
    const updated = await users.updateProfile(userId, profile);
    return updated.ok ? ok(userId) : updated;
  }

  const user = { id: newUserId(), ...profile, createdAt: now() };
  const chart = startingChart(accountsStartOn ?? dayOf(user.createdAt), newAccountId);
  const added = await users.add(user, identity, chart);
  if (added.ok) {
    return ok(user.id);
  }
  const raced = await users.findByIdentity(identity);
  if (!raced.ok) {
    return raced;
  }
  return raced.value === undefined ? added : ok(raced.value.id);
}
