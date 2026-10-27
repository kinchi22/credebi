import { describe, expect, it } from 'vitest';
import {
  domainError,
  err,
  isErr,
  isOk,
  ok,
  type AccountGroupId,
  type AccountId,
  type DomainError,
  type Err,
  type Language,
  type Result,
  type UserId,
} from '@repo/contracts';
import {
  type Account,
  type Chart,
  type StartingChartCopy,
  type StartingNode,
} from '../../accounts/domain/account';
import { DEFAULT_SETTINGS, type Settings } from '../../settings/domain/settings';
import { type SettingsRepository } from '../../settings/ports/settings-repository';
import { SIGNED_OUT, type AuthContext } from '../domain/auth-context';
import {
  sessionExpiry,
  type Session,
  type SessionToken,
  type SessionTokenHash,
  type StoredSession,
} from '../domain/session';
import { type GoogleClaims, type Identity, type User } from '../domain/user';
import { type GoogleSignIn, type PendingSignIn } from '../ports/google-sign-in';
import { type SessionRepository } from '../ports/session-repository';
import { type UserRepository } from '../ports/user-repository';
import { createBeginGoogleSignIn } from './begin-google-sign-in';
import { createResolveSession } from './resolve-session';
import {
  createFinishGoogleSignIn,
  createTestSignIn,
  type IssuedSession,
  type SignInDependencies,
} from './sign-in';
import { createSignOut } from './sign-out';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-18T12:00:00.000Z');
const UNAVAILABLE = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');

const identityKey = (identity: Identity): string => `${identity.provider}:${identity.subject}`;

type UserStore = UserRepository & {
  readonly users: Map<UserId, User>;
  readonly identities: Map<string, UserId>;
  readonly charts: Map<UserId, Chart>;
  readonly settings: Map<UserId, Settings>;
};

function inMemoryUsers(): UserStore {
  const users = new Map<UserId, User>();
  const identities = new Map<string, UserId>();
  const charts = new Map<UserId, Chart>();
  const settings = new Map<UserId, Settings>();
  return {
    users,
    identities,
    charts,
    settings,
    findByIdentity: (identity) => {
      const userId = identities.get(identityKey(identity));
      return Promise.resolve(ok(userId === undefined ? undefined : users.get(userId)));
    },
    add: (user, identity, chart, userSettings) => {
      if (identities.has(identityKey(identity))) {
        return Promise.resolve(err(domainError('CONFLICT', 'That Identity has a User.')));
      }
      users.set(user.id, user);
      identities.set(identityKey(identity), user.id);
      charts.set(user.id, chart);
      settings.set(user.id, userSettings);
      return Promise.resolve(ok(undefined));
    },
    updateProfile: (userId, profile) => {
      const user = users.get(userId);
      if (user !== undefined) {
        users.set(userId, { ...user, ...profile });
      }
      return Promise.resolve(ok(undefined));
    },
  };
}

type SessionStore = SessionRepository & {
  readonly rows: Map<SessionTokenHash, StoredSession>;
};

function inMemorySessions(): SessionStore {
  const rows = new Map<SessionTokenHash, StoredSession>();
  return {
    rows,
    add: (session: Session) => {
      rows.set(session.tokenHash, { ...session, slides: true });
      return Promise.resolve(ok(undefined));
    },
    find: (tokenHash) => Promise.resolve(ok(rows.get(tokenHash))),
    renew: (tokenHash, expiresAt) => {
      const row = rows.get(tokenHash);
      if (row !== undefined) {
        rows.set(tokenHash, { ...row, expiresAt });
      }
      return Promise.resolve(ok(undefined));
    },
    remove: (tokenHash) => {
      rows.delete(tokenHash);
      return Promise.resolve(ok(undefined));
    },
  };
}

const failing = (): Promise<Err<DomainError>> => Promise.resolve(err(UNAVAILABLE));

const settingsOf = (store: UserStore): Pick<SettingsRepository, 'read'> => ({
  read: (userId) => Promise.resolve(ok(store.settings.get(userId) ?? DEFAULT_SETTINGS)),
});

const STARTING_NODES: readonly StartingNode[] = [
  'cashAndDeposits',
  'cash',
  'bankDeposits',
  'creditCardPayable',
  'openingBalanceEquity',
  'salary',
  'livingExpenses',
  'food',
  'transportation',
  'otherLivingExpenses',
];

const startingChartCopy = (language: Language): StartingChartCopy =>
  Object.fromEntries(
    STARTING_NODES.map((node) => [
      node,
      { name: `${node} in ${language}`, description: `About ${node} in ${language}` },
    ]),
  ) as Record<StartingNode, { name: string; description: string }>;

const namesIn = (language: Language): readonly string[] => [
  `cash in ${language}`,
  `bankDeposits in ${language}`,
  `creditCardPayable in ${language}`,
  `openingBalanceEquity in ${language}`,
  `salary in ${language}`,
  `food in ${language}`,
  `transportation in ${language}`,
  `otherLivingExpenses in ${language}`,
];

const NO_CHART: Chart = { accounts: [], groups: [] };

const EXISTING_CHART: Chart = {
  groups: [],
  accounts: (
    [
      ['asset', 'Cash'],
      ['liability', 'Accounts payable'],
      ['equity', 'Capital'],
      ['revenue', 'Sales'],
      ['expense', 'Expenses'],
    ] as const
  ).map(([accountType, name], n) => ({
    id: `01920000-0000-7000-8000-00000000e00${String(n)}` as AccountId,
    accountType,
    groupId: null,
    name,
    description: null,
    position: 0,
    activeFrom: '2025-01-01',
    activeUntil: null,
  })),
};

const hash = (token: string): SessionTokenHash => `sha256(${token})` as SessionTokenHash;

function google(claims: GoogleClaims): GoogleSignIn {
  return {
    begin: (redirectUri) =>
      Promise.resolve(
        ok({
          authorizationUrl: new URL(
            `https://accounts.google.test/auth?state=issued&redirect_uri=${encodeURIComponent(redirectUri.href)}`,
          ),
          pending: { state: 'issued', codeVerifier: 'verifier' },
        }),
      ),
    complete: (callbackUrl, pending) =>
      Promise.resolve(
        callbackUrl.searchParams.get('state') === pending.state
          ? ok(claims)
          : err(domainError('INVALID_INPUT', 'The state does not match.')),
      ),
  };
}

const ADA: GoogleClaims = { sub: 'google-ada', email: 'ada@example.com', name: 'Ada' };
const CALLBACK = new URL('https://app.test/auth/callback/google?state=issued&code=c');
const PENDING: PendingSignIn = { state: 'issued', codeVerifier: 'verifier' };

function world(
  overrides: Partial<Omit<SignInDependencies, 'users'>> & { readonly users?: UserStore } = {},
) {
  const users = overrides.users ?? inMemoryUsers();
  const sessions = inMemorySessions();
  let clock = NOW;
  let userCount = 0;
  let accountCount = 0;
  let groupCount = 0;
  let tokenCount = 0;
  const dependencies: SignInDependencies = {
    users,
    sessions,
    settings: settingsOf(users),
    startingChartCopy,
    newUserId: () => {
      userCount += 1;
      return `01920000-0000-7000-8000-${String(userCount).padStart(12, '0')}` as UserId;
    },
    newAccountId: () => {
      accountCount += 1;
      return `01920000-0000-7000-8000-00000000c${String(accountCount).padStart(3, '0')}` as AccountId;
    },
    newAccountGroupId: () => {
      groupCount += 1;
      return `01920000-0000-7000-8000-00000000d${String(groupCount).padStart(3, '0')}` as AccountGroupId;
    },
    newSessionToken: () => {
      tokenCount += 1;
      return `token-${String(tokenCount)}` as SessionToken;
    },
    hashSessionToken: hash,
    now: () => clock,
    ...overrides,
  };
  const resolveDependencies = {
    sessions: dependencies.sessions,
    hashSessionToken: hash,
    now: () => clock,
  };
  return {
    users,
    sessions,
    advance: (milliseconds: number): void => {
      clock = new Date(clock.getTime() + milliseconds);
    },
    testSignIn: createTestSignIn(dependencies),
    finishGoogleSignIn: createFinishGoogleSignIn({ ...dependencies, google: google(ADA) }),
    resolveSession: createResolveSession(resolveDependencies),
    signOut: createSignOut(resolveDependencies),
  };
}

function issued(result: Result<IssuedSession, DomainError>): IssuedSession {
  expect(isOk(result), 'the sign-in was expected to succeed').toBe(true);
  return isOk(result) ? result.value : { token: '' as SessionToken, expiresAt: NOW, language: 'en' };
}

async function whoIs(
  resolveSession: (token: string | undefined) => Promise<Result<AuthContext, DomainError>>,
  token: string | undefined,
): Promise<AuthContext> {
  const result = await resolveSession(token);
  expect(isOk(result), 'resolving the Session was expected to succeed').toBe(true);
  return isOk(result) ? result.value : SIGNED_OUT;
}

describe('createTestSignIn', () => {
  it('creates a User for a new identifier, and a Session that signs them in', async () => {
    const { testSignIn, resolveSession, users } = world();

    const session = issued(await testSignIn('e2e-1', 'en'));

    expect([...users.users.values()]).toEqual([
      {
        id: '01920000-0000-7000-8000-000000000001',
        email: 'e2e-1@test.invalid',
        name: null,
        createdAt: NOW,
      },
    ]);
    expect(await whoIs(resolveSession, session.token)).toEqual({
      userId: '01920000-0000-7000-8000-000000000001',
    });
  });

  it('creates a new User with two Account groups and eight Accounts, named and described in their Language, starting on the day it was created', async () => {
    const { testSignIn, users } = world({ now: () => new Date('2026-09-18T23:30:00.000Z') });

    issued(await testSignIn('e2e-1', 'en'));

    const groupId = (n: number): AccountGroupId =>
      `01920000-0000-7000-8000-00000000d00${String(n)}` as AccountGroupId;
    const starting = (
      n: number,
      accountType: Account['accountType'],
      group: number | null,
      position: number,
      node: StartingNode,
    ): Account => ({
      id: `01920000-0000-7000-8000-00000000c00${String(n)}` as AccountId,
      accountType,
      groupId: group === null ? null : groupId(group),
      name: `${node} in en`,
      description: `About ${node} in en`,
      position,
      activeFrom: '2026-09-18',
      activeUntil: null,
    });
    expect([...users.charts.entries()]).toEqual([
      [
        '01920000-0000-7000-8000-000000000001',
        {
          groups: [
            {
              id: groupId(1),
              accountType: 'asset',
              name: 'cashAndDeposits in en',
              description: 'About cashAndDeposits in en',
              position: 0,
            },
            {
              id: groupId(2),
              accountType: 'expense',
              name: 'livingExpenses in en',
              description: 'About livingExpenses in en',
              position: 0,
            },
          ],
          accounts: [
            starting(1, 'asset', 1, 0, 'cash'),
            starting(2, 'asset', 1, 1, 'bankDeposits'),
            starting(3, 'liability', null, 0, 'creditCardPayable'),
            starting(4, 'equity', null, 0, 'openingBalanceEquity'),
            starting(5, 'revenue', null, 0, 'salary'),
            starting(6, 'expense', 2, 0, 'food'),
            starting(7, 'expense', 2, 1, 'transportation'),
            starting(8, 'expense', 2, 2, 'otherLivingExpenses'),
          ],
        },
      ],
    ]);
  });

  it.each(['ko', 'ja'] as const)(
    'creates a new User with %s, the Language the sign-in takes, as their Setting, and starting Accounts named in it',
    async (language) => {
      const { testSignIn, users } = world();

      const session = issued(await testSignIn('e2e-1', language));

      const userId = '01920000-0000-7000-8000-000000000001' as UserId;
      expect(users.settings.get(userId)).toEqual({ ...DEFAULT_SETTINGS, language });
      const chart = users.charts.get(userId);
      expect(chart?.groups.map(({ name }) => name)).toEqual([
        `cashAndDeposits in ${language}`,
        `livingExpenses in ${language}`,
      ]);
      expect(chart?.accounts.map(({ name }) => name)).toEqual(namesIn(language));
      expect(chart?.accounts.map(({ description }) => description)).toEqual(
        namesIn(language).map((name) => `About ${name}`),
      );
      expect(session.language).toBe(language);
    },
  );

  it("leaves an existing User's Language and Account names as they were, and signs them in to their own Language", async () => {
    const { testSignIn, users } = world();
    issued(await testSignIn('e2e-1', 'ja'));
    const settings = [...users.settings.values()];
    const charts = [...users.charts.values()];

    const session = issued(await testSignIn('e2e-1', 'ko'));

    expect([...users.settings.values()]).toEqual(settings);
    expect(settings.map(({ language }) => language)).toEqual(['ja']);
    expect([...users.charts.values()]).toEqual(charts);
    expect(session.language).toBe('ja');
  });

  it('signs an existing User in to the Language their Settings hold now', async () => {
    const { testSignIn, users } = world();
    issued(await testSignIn('e2e-1', 'en'));
    const userId = '01920000-0000-7000-8000-000000000001' as UserId;
    users.settings.set(userId, { ...DEFAULT_SETTINGS, language: 'ko' });

    const session = issued(await testSignIn('e2e-1', 'ja'));

    expect(session.language).toBe('ko');
  });

  it("passes a failure to read an existing User's Settings through, and begins no Session", async () => {
    const { testSignIn, sessions } = world({ settings: { read: failing } });
    issued(await testSignIn('e2e-1', 'en'));

    const result = await testSignIn('e2e-1', 'en');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
    expect(sessions.rows.size).toBe(1);
  });

  it('gives a User signing in again no Accounts beyond those it was created with', async () => {
    const { testSignIn, users } = world();
    issued(await testSignIn('e2e-1', 'en'));
    const created = [...users.charts.values()];

    issued(await testSignIn('e2e-1', 'en'));

    expect([...users.charts.values()]).toEqual(created);
  });

  it("starts a new User's eight starting Accounts on the day the sign-in names", async () => {
    const { testSignIn, users } = world();

    issued(await testSignIn('e2e-1', 'en', '2000-01-01'));

    const accounts = [...users.charts.values()].flatMap((chart) => chart.accounts);
    expect(accounts.map(({ name }) => name)).toEqual(namesIn('en'));
    expect(accounts.map(({ activeFrom }) => activeFrom)).toEqual(Array(8).fill('2000-01-01'));
    expect(accounts.map(({ activeUntil }) => activeUntil)).toEqual(Array(8).fill(null));
  });

  it("leaves an existing User's chart as it was, adding none of the starting chart", async () => {
    const users = inMemoryUsers();
    const ada: User = {
      id: '01920000-0000-7000-8000-0000000000aa' as UserId,
      email: 'e2e-1@test.invalid',
      name: null,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    };
    await users.add(ada, { provider: 'test', subject: 'e2e-1' }, EXISTING_CHART, DEFAULT_SETTINGS);
    const { testSignIn, resolveSession } = world({ users });

    const session = issued(await testSignIn('e2e-1', 'en'));

    expect(await whoIs(resolveSession, session.token)).toEqual({ userId: ada.id });
    expect([...users.charts.entries()]).toEqual([[ada.id, EXISTING_CHART]]);
  });

  it("changes none of an existing User's Accounts when the sign-in names a day", async () => {
    const { testSignIn, users } = world();
    issued(await testSignIn('e2e-1', 'en'));
    const created = [...users.charts.values()];

    issued(await testSignIn('e2e-1', 'en', '2000-01-01'));

    expect([...users.charts.values()]).toEqual(created);
    expect(created.flatMap(({ accounts }) => accounts.map(({ activeFrom }) => activeFrom))).toEqual(
      Array(8).fill('2026-09-18'),
    );
  });

  it.each(['', '2026-02-30', '18/09/2026'])(
    'refuses %j as the day the Accounts start on, and creates nobody',
    async (day) => {
      const { testSignIn, users, sessions } = world();

      const result = await testSignIn('e2e-1', 'en', day);

      expect(isErr(result) && result.error.code).toBe('INVALID_INPUT');
      expect(users.users.size).toBe(0);
      expect(users.charts.size).toBe(0);
      expect(sessions.rows.size).toBe(0);
    },
  );

  it('issues a Session for 30 days, and stores only the hash of its token', async () => {
    const { testSignIn, sessions } = world();

    const session = issued(await testSignIn('e2e-1', 'en'));

    expect(session).toEqual({ token: 'token-1', expiresAt: sessionExpiry(NOW), language: 'en' });
    expect([...sessions.rows.keys()]).toEqual([hash('token-1')]);
  });

  it('signs the same identifier in as the same User, with a Session each time', async () => {
    const { testSignIn, resolveSession, users } = world();

    const first = issued(await testSignIn('e2e-1', 'en'));
    const second = issued(await testSignIn('e2e-1', 'en'));

    expect(users.users.size).toBe(1);
    expect(second.token).not.toBe(first.token);
    expect(await whoIs(resolveSession, second.token)).toEqual(
      await whoIs(resolveSession, first.token),
    );
  });

  it('signs different identifiers in as different Users', async () => {
    const { testSignIn, resolveSession } = world();

    const one = issued(await testSignIn('e2e-1', 'en'));
    const other = issued(await testSignIn('e2e-2', 'en'));

    expect(await whoIs(resolveSession, one.token)).not.toEqual(
      await whoIs(resolveSession, other.token),
    );
  });

  it('refuses a blank identifier, and creates nobody', async () => {
    const { testSignIn, users, sessions } = world();

    const result = await testSignIn('  ', 'en');

    expect(isErr(result) && result.error.code).toBe('INVALID_INPUT');
    expect(users.users.size).toBe(0);
    expect(sessions.rows.size).toBe(0);
  });

  it('passes a failure to find the User through, and begins no Session', async () => {
    const users = { ...inMemoryUsers(), findByIdentity: failing };
    const { testSignIn, sessions } = world({ users });

    const result = await testSignIn('e2e-1', 'en');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
    expect(sessions.rows.size).toBe(0);
  });

  it('passes a failure to add the User through, and begins no Session', async () => {
    const users = { ...inMemoryUsers(), add: failing };
    const { testSignIn, sessions } = world({ users });

    const result = await testSignIn('e2e-1', 'en');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
    expect(sessions.rows.size).toBe(0);
  });

  it('passes a failure to store the Session through', async () => {
    const sessions = { ...inMemorySessions(), add: failing };
    const { testSignIn } = world({ sessions });

    const result = await testSignIn('e2e-1', 'en');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
  });
});

describe('a first sign-in that races another', () => {
  const EARLIER: User = {
    id: '01920000-0000-7000-8000-0000000000ff' as UserId,
    email: 'e2e-1@test.invalid',
    name: null,
    createdAt: NOW,
  };

  function racedBy(
    earlier: User | undefined,
    findAgain?: UserRepository['findByIdentity'],
  ): UserStore {
    const store = inMemoryUsers();
    let finds = 0;
    return {
      ...store,
      findByIdentity: (identity) => {
        finds += 1;
        if (finds > 1 && findAgain !== undefined) {
          return findAgain(identity);
        }
        return finds === 1 ? Promise.resolve(ok(undefined)) : store.findByIdentity(identity);
      },
      add: async (_user, identity) => {
        if (earlier !== undefined) {
          await store.add(earlier, identity, NO_CHART, { ...DEFAULT_SETTINGS, language: 'ja' });
        }
        return err(domainError('CONFLICT', 'That Identity has a User.'));
      },
    };
  }

  it('signs in as the User the other sign-in added, in their Language', async () => {
    const { testSignIn, resolveSession } = world({ users: racedBy(EARLIER) });

    const session = issued(await testSignIn('e2e-1', 'ko'));

    expect(await whoIs(resolveSession, session.token)).toEqual({ userId: EARLIER.id });
    expect(session.language).toBe('ja');
  });

  it('reports the conflict when the User it lost to cannot be found', async () => {
    const { testSignIn } = world({ users: racedBy(undefined) });

    const result = await testSignIn('e2e-1', 'en');

    expect(isErr(result) && result.error.code).toBe('CONFLICT');
  });

  it('passes a failure to find the User again through', async () => {
    const { testSignIn } = world({ users: racedBy(EARLIER, failing) });

    const result = await testSignIn('e2e-1', 'en');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
  });
});

describe('createFinishGoogleSignIn', () => {
  it('creates a User from what Google vouches for, and signs them in', async () => {
    const { finishGoogleSignIn, resolveSession, users } = world();

    const session = issued(await finishGoogleSignIn(CALLBACK, PENDING, 'en'));

    expect([...users.users.values()]).toEqual([
      {
        id: '01920000-0000-7000-8000-000000000001',
        email: 'ada@example.com',
        name: 'Ada',
        createdAt: NOW,
      },
    ]);
    expect([...users.identities.keys()]).toEqual(['google:google-ada']);
    expect(
      users.charts.get('01920000-0000-7000-8000-000000000001' as UserId)?.accounts.map(({ name }) => name),
    ).toEqual(namesIn('en'));
    expect(await whoIs(resolveSession, session.token)).toEqual({
      userId: '01920000-0000-7000-8000-000000000001',
    });
  });

  it('creates a User from Google in the Language the sign-in takes, and keeps an existing one in theirs', async () => {
    const { finishGoogleSignIn, users } = world();

    const created = issued(await finishGoogleSignIn(CALLBACK, PENDING, 'ko'));
    const again = issued(await finishGoogleSignIn(CALLBACK, PENDING, 'ja'));

    expect([...users.settings.values()]).toEqual([{ ...DEFAULT_SETTINGS, language: 'ko' }]);
    expect([...users.charts.values()].flatMap(({ accounts }) => accounts.map(({ name }) => name))).toEqual(
      namesIn('ko'),
    );
    expect([created.language, again.language]).toEqual(['ko', 'ko']);
  });

  it('keeps what Google says at the latest sign-in', async () => {
    const { finishGoogleSignIn, users } = world();
    await finishGoogleSignIn(CALLBACK, PENDING, 'en');

    const renamed = createFinishGoogleSignIn({
      users,
      sessions: inMemorySessions(),
      settings: settingsOf(users),
      startingChartCopy,
      newUserId: () => '01920000-0000-7000-8000-000000000009' as UserId,
      newAccountId: () => '01920000-0000-7000-8000-00000000c009' as AccountId,
      newAccountGroupId: () => '01920000-0000-7000-8000-00000000d009' as AccountGroupId,
      newSessionToken: () => 'token-9' as SessionToken,
      hashSessionToken: hash,
      now: () => NOW,
      google: google({ ...ADA, email: 'ada@lovelace.test', name: undefined }),
    });
    issued(await renamed(CALLBACK, PENDING, 'en'));

    expect([...users.users.values()]).toEqual([
      {
        id: '01920000-0000-7000-8000-000000000001',
        email: 'ada@lovelace.test',
        name: null,
        createdAt: NOW,
      },
    ]);
  });

  it('passes a failure to keep the profile through, and begins no Session', async () => {
    const users = { ...inMemoryUsers(), updateProfile: failing };
    const { finishGoogleSignIn, sessions } = world({ users });
    issued(await finishGoogleSignIn(CALLBACK, PENDING, 'en'));

    const result = await finishGoogleSignIn(CALLBACK, PENDING, 'en');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
    expect(sessions.rows.size).toBe(1);
  });

  it('signs nobody in from a callback this browser never began', async () => {
    const { finishGoogleSignIn, users, sessions } = world();

    const result = await finishGoogleSignIn(CALLBACK, undefined, 'en');

    expect(isErr(result) && result.error).toEqual(
      domainError('INVALID_INPUT', 'No sign-in with Google was begun here.'),
    );
    expect(users.users.size).toBe(0);
    expect(sessions.rows.size).toBe(0);
  });

  it('signs nobody in when Google does not answer the pending sign-in', async () => {
    const { finishGoogleSignIn, users, sessions } = world();

    const result = await finishGoogleSignIn(CALLBACK, { ...PENDING, state: 'forged' }, 'en');

    expect(isErr(result) && result.error).toEqual(
      domainError('INVALID_INPUT', 'The state does not match.'),
    );
    expect(users.users.size).toBe(0);
    expect(sessions.rows.size).toBe(0);
  });

  it('signs nobody in when Google gives no email address', async () => {
    const { users, sessions, ...rest } = world();
    const finish = createFinishGoogleSignIn({
      users,
      sessions,
      settings: settingsOf(users),
      startingChartCopy,
      newUserId: () => '01920000-0000-7000-8000-000000000001' as UserId,
      newAccountId: () => '01920000-0000-7000-8000-00000000c001' as AccountId,
      newAccountGroupId: () => '01920000-0000-7000-8000-00000000d001' as AccountGroupId,
      newSessionToken: () => 'token-1' as SessionToken,
      hashSessionToken: hash,
      now: () => NOW,
      google: google({ ...ADA, email: undefined }),
    });

    const result = await finish(CALLBACK, PENDING, 'en');

    expect(isErr(result) && result.error.code).toBe('INVALID_INPUT');
    expect(users.users.size).toBe(0);
    expect(await whoIs(rest.resolveSession, 'token-1')).toEqual(SIGNED_OUT);
  });
});

describe('createBeginGoogleSignIn', () => {
  it("answers with Google's authorization URL and what the browser must bring back", async () => {
    const begin = createBeginGoogleSignIn({ google: google(ADA) });

    const result = await begin(new URL('https://app.test/auth/callback/google'));

    expect(isOk(result) && result.value).toEqual({
      authorizationUrl: new URL(
        'https://accounts.google.test/auth?state=issued&redirect_uri=https%3A%2F%2Fapp.test%2Fauth%2Fcallback%2Fgoogle',
      ),
      pending: PENDING,
    });
  });
});

describe('createResolveSession', () => {
  it.each([
    ['no cookie', undefined],
    ['an empty cookie', ''],
    ['a token the app never issued', 'token-404'],
  ])('signs nobody in with %s', async (_case, token) => {
    const { testSignIn, resolveSession } = world();
    issued(await testSignIn('e2e-1', 'en'));

    expect(await whoIs(resolveSession, token)).toEqual(SIGNED_OUT);
  });

  it.each([
    ['no cookie', undefined],
    ['an empty cookie', ''],
  ])('signs nobody in with %s without asking the Session store', async (_case, token) => {
    const sessions = { ...inMemorySessions(), find: failing };
    const resolveSession = createResolveSession({ sessions, hashSessionToken: hash, now: () => NOW });

    expect(await whoIs(resolveSession, token)).toEqual(SIGNED_OUT);
  });

  it('signs nobody in once the Session has ended', async () => {
    const { testSignIn, resolveSession, advance } = world();
    const session = issued(await testSignIn('e2e-1', 'en'));

    advance(30 * DAY);

    expect(await whoIs(resolveSession, session.token)).toEqual(SIGNED_OUT);
  });

  it('leaves a Session in the first half of its lifetime as it was', async () => {
    const { testSignIn, resolveSession, sessions, advance } = world();
    const session = issued(await testSignIn('e2e-1', 'en'));

    advance(10 * DAY);
    await whoIs(resolveSession, session.token);

    expect(sessions.rows.get(hash(session.token))?.expiresAt).toEqual(session.expiresAt);
  });

  it('renews a Session used in its second half, so it outlives its first expiry', async () => {
    const { testSignIn, resolveSession, sessions, advance } = world();
    const session = issued(await testSignIn('e2e-1', 'en'));
    const signedIn = await whoIs(resolveSession, session.token);

    advance(20 * DAY);
    expect(await whoIs(resolveSession, session.token)).toEqual(signedIn);
    expect(sessions.rows.get(hash(session.token))?.expiresAt).toEqual(
      new Date(NOW.getTime() + 50 * DAY),
    );

    advance(20 * DAY);
    expect(await whoIs(resolveSession, session.token)).toEqual(signedIn);
  });

  it("never renews a Session that does not slide, as the Smoke User's does not", async () => {
    const { resolveSession, sessions, advance } = world();
    const userId = '01920000-0000-7000-8000-00000000000a' as UserId;
    const expiresAt = new Date(NOW.getTime() + DAY);
    sessions.rows.set(hash('smoke'), { tokenHash: hash('smoke'), userId, expiresAt, slides: false });

    expect(await whoIs(resolveSession, 'smoke')).toEqual({ userId });
    expect(sessions.rows.get(hash('smoke'))?.expiresAt).toEqual(expiresAt);

    advance(DAY);
    expect(await whoIs(resolveSession, 'smoke')).toEqual(SIGNED_OUT);
  });

  it('reports a Session store that cannot answer, rather than signing nobody in', async () => {
    const sessions = { ...inMemorySessions(), find: failing };
    const resolveSession = createResolveSession({ sessions, hashSessionToken: hash, now: () => NOW });

    const result = await resolveSession('token-1');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
  });

  it('reports a renewal that could not be stored', async () => {
    const { testSignIn, sessions } = world();
    const session = issued(await testSignIn('e2e-1', 'en'));
    const resolveSession = createResolveSession({
      sessions: { ...sessions, renew: failing },
      hashSessionToken: hash,
      now: () => new Date(NOW.getTime() + 20 * DAY),
    });

    const result = await resolveSession(session.token);

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
  });
});

describe('createSignOut', () => {
  it('ends the Session at once, and only that one', async () => {
    const { testSignIn, resolveSession, signOut } = world();
    const here = issued(await testSignIn('e2e-1', 'en'));
    const elsewhere = issued(await testSignIn('e2e-1', 'en'));
    const signedIn = await whoIs(resolveSession, elsewhere.token);

    const result = await signOut(here.token);

    expect(isOk(result)).toBe(true);
    expect(await whoIs(resolveSession, here.token)).toEqual(SIGNED_OUT);
    expect(await whoIs(resolveSession, elsewhere.token)).toEqual(signedIn);
  });

  it.each([
    ['no cookie', undefined],
    ['an empty cookie', ''],
  ])('is already done with %s', async (_case, token) => {
    const { signOut } = world({ sessions: { ...inMemorySessions(), remove: failing } });

    expect(isOk(await signOut(token))).toBe(true);
  });

  it('reports a Session that could not be ended', async () => {
    const sessions = { ...inMemorySessions(), remove: failing };
    const signOut = createSignOut({ sessions, hashSessionToken: hash });

    const result = await signOut('token-1');

    expect(isErr(result) && result.error).toEqual(UNAVAILABLE);
  });
});
