import {
  domainError,
  err,
  ok,
  type AccountGroupId,
  type AccountId,
  type DomainError,
  type Language,
  type Result,
  type UserId,
} from '@repo/contracts';
import {
  dayOf,
  parseDay,
  startingChart,
  type StartingChartCopy,
} from '../../accounts/domain/account';
import { DEFAULT_SETTINGS } from '../../settings/domain/settings';
import { type SettingsRepository } from '../../settings/ports/settings-repository';
import { sessionExpiry, type SessionToken, type SessionTokenHash } from '../domain/session';
import { googleSignIn, testSignIn, type SignInClaims } from '../domain/user';
import { type GoogleSignIn, type PendingSignIn } from '../ports/google-sign-in';
import { type SessionRepository } from '../ports/session-repository';
import { type UserRepository } from '../ports/user-repository';

export type SignInDependencies = {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly settings: Pick<SettingsRepository, 'read'>;
  readonly startingChartCopy: (language: Language) => StartingChartCopy;
  readonly newUserId: () => UserId;
  readonly newAccountId: () => AccountId;
  readonly newAccountGroupId: () => AccountGroupId;
  readonly newSessionToken: () => SessionToken;
  readonly hashSessionToken: (token: string) => SessionTokenHash;
  readonly now: () => Date;
};

export type IssuedSession = {
  readonly token: SessionToken;
  readonly expiresAt: Date;
  readonly language: Language;
};

export type TestSignIn = (
  identifier: string,
  language: Language,
  accountsStartOn?: string,
) => Promise<Result<IssuedSession, DomainError>>;

export type FinishGoogleSignIn = (
  callbackUrl: URL,
  pending: PendingSignIn | undefined,
  language: Language,
) => Promise<Result<IssuedSession, DomainError>>;

export function createTestSignIn(dependencies: SignInDependencies): TestSignIn {
  return async (identifier, language, accountsStartOn) => {
    const claims = testSignIn(identifier);
    if (!claims.ok) {
      return claims;
    }
    if (accountsStartOn === undefined) {
      return signIn(dependencies, claims.value, { language });
    }
    const startsOn = parseDay(accountsStartOn);
    return startsOn.ok
      ? signIn(dependencies, claims.value, { language, accountsStartOn: startsOn.value })
      : startsOn;
  };
}

export function createFinishGoogleSignIn(
  dependencies: SignInDependencies & { readonly google: GoogleSignIn },
): FinishGoogleSignIn {
  return async (callbackUrl, pending, language) => {
    if (pending === undefined) {
      return err(domainError('INVALID_INPUT', 'No sign-in with Google was begun here.'));
    }
    const answered = await dependencies.google.complete(callbackUrl, pending);
    if (!answered.ok) {
      return answered;
    }
    const claims = googleSignIn(answered.value);
    return claims.ok
      ? signIn(dependencies, claims.value, { language })
      : claims;
  };
}

type SignInRequest = {
  readonly language: Language;
  readonly accountsStartOn?: string;
};

type SignedInUser = {
  readonly userId: UserId;
  readonly language: Language;
};

async function signIn(
  dependencies: SignInDependencies,
  claims: SignInClaims,
  request: SignInRequest,
): Promise<Result<IssuedSession, DomainError>> {
  const user = await findOrAddUser(dependencies, claims, request);
  if (!user.ok) {
    return user;
  }

  const { sessions, newSessionToken, hashSessionToken, now } = dependencies;
  const token = newSessionToken();
  const expiresAt = sessionExpiry(now());
  const added = await sessions.add({
    tokenHash: hashSessionToken(token),
    userId: user.value.userId,
    expiresAt,
  });
  return added.ok ? ok({ token, expiresAt, language: user.value.language }) : added;
}

async function withStoredLanguage(
  { settings }: SignInDependencies,
  userId: UserId,
): Promise<Result<SignedInUser, DomainError>> {
  const read = await settings.read(userId);
  return read.ok ? ok({ userId, language: read.value.language }) : read;
}

async function findOrAddUser(
  dependencies: SignInDependencies,
  { identity, profile }: SignInClaims,
  { language, accountsStartOn }: SignInRequest,
): Promise<Result<SignedInUser, DomainError>> {
  const { users, newUserId, newAccountId, newAccountGroupId, startingChartCopy, now } = dependencies;
  const found = await users.findByIdentity(identity);
  if (!found.ok) {
    return found;
  }
  if (found.value !== undefined) {
    const userId = found.value.id;
    const updated = await users.updateProfile(userId, profile);
    return updated.ok ? withStoredLanguage(dependencies, userId) : updated;
  }

  const user = { id: newUserId(), ...profile, createdAt: now() };
  const chart = startingChart(
    accountsStartOn ?? dayOf(user.createdAt),
    startingChartCopy(language),
    { newAccountId, newAccountGroupId },
  );
  const added = await users.add(user, identity, chart, { ...DEFAULT_SETTINGS, language });
  if (added.ok) {
    return ok({ userId: user.id, language });
  }
  const raced = await users.findByIdentity(identity);
  if (!raced.ok) {
    return raced;
  }
  return raced.value === undefined ? added : withStoredLanguage(dependencies, raced.value.id);
}
