import 'server-only';
import {
  accountGroupIdSchema,
  accountIdSchema,
  domainError,
  entryIdSchema,
  err,
  userIdSchema,
  type AccountId,
} from '@repo/contracts';
import {
  createAddAccount,
  createAddAccountGroup,
  createDeleteAccount,
  createDeleteAccountGroup,
  createBeginGoogleSignIn,
  createChangeEntryFormMode,
  createDeleteEntry,
  createEditAccount,
  createEditAccountGroup,
  createMoveChartNode,
  createEditEntry,
  createFinishGoogleSignIn,
  createGetChart,
  createGetHealth,
  createGetSettings,
  createPostEntry,
  createResolveSession,
  createSearchEntries,
  createSignOut,
  createTestSignIn,
  type AddAccount,
  type AddAccountGroup,
  type DeleteAccount,
  type DeleteAccountGroup,
  type BeginGoogleSignIn,
  type ChangeEntryFormMode,
  type DeleteEntry,
  type EditAccount,
  type EditAccountGroup,
  type MoveChartNode,
  type EditEntry,
  type FinishGoogleSignIn,
  type GetChart,
  type GetHealth,
  type GetSettings,
  type PostEntry,
  type ResolveSession,
  type SearchEntries,
  type SignOut,
  type TestSignIn,
} from '@repo/core';
import {
  createOpenIdGoogleSignIn,
  createPostgresAccountRepository,
  createPostgresEntryRepository,
  createPostgresHealthProbe,
  createPostgresSessionRepository,
  createPostgresSettingsRepository,
  createPostgresUnitOfWork,
  createPostgresUserRepository,
  hashSessionToken,
  newSessionToken,
} from '@repo/core/server';
import { v7 as uuidv7 } from 'uuid';
import { type Env, parseEnv } from './env';
import { createLogger, stderr } from './logger';

export type Container = {
  readonly getHealth: GetHealth;
  readonly postEntry: PostEntry;
  readonly searchEntries: SearchEntries;
  readonly editEntry: EditEntry;
  readonly deleteEntry: DeleteEntry;
  readonly getChart: GetChart;
  readonly addAccount: AddAccount;
  readonly editAccount: EditAccount;
  readonly addAccountGroup: AddAccountGroup;
  readonly editAccountGroup: EditAccountGroup;
  readonly deleteAccount: DeleteAccount;
  readonly deleteAccountGroup: DeleteAccountGroup;
  readonly moveChartNode: MoveChartNode;
  readonly getSettings: GetSettings;
  readonly changeEntryFormMode: ChangeEntryFormMode;
  readonly resolveSession: ResolveSession;
  readonly beginGoogleSignIn: BeginGoogleSignIn;
  readonly finishGoogleSignIn: FinishGoogleSignIn;
  readonly testSignInOffered: boolean;
  readonly testSignIn: TestSignIn;
  readonly signOut: SignOut;
};

const noTestSignIn: TestSignIn = () =>
  Promise.resolve(err(domainError('NOT_FOUND', 'There is no test sign-in here.')));

export function createContainer({ databaseUrl, google, testSignIn }: Env): Container {
  const logger = createLogger(stderr());
  const postgres = createPostgresHealthProbe(databaseUrl, logger);
  const entries = createPostgresEntryRepository(databaseUrl, logger);
  const accounts = createPostgresAccountRepository(databaseUrl, logger);
  const sessions = createPostgresSessionRepository(databaseUrl, logger);
  const settings = createPostgresSettingsRepository(databaseUrl, logger);
  const newAccountId = (): AccountId => accountIdSchema.parse(uuidv7());
  const signIn = {
    users: createPostgresUserRepository(databaseUrl, logger),
    sessions,
    newUserId: () => userIdSchema.parse(uuidv7()),
    newAccountId,
    newSessionToken,
    hashSessionToken,
    now: () => new Date(),
  };
  const googleSignIn = createOpenIdGoogleSignIn(google, logger);

  return {
    getHealth: createGetHealth({
      probes: [postgres],
      now: () => new Date(),
    }),
    postEntry: createPostEntry({
      entries,
      accounts,
      newEntryId: () => entryIdSchema.parse(uuidv7()),
      now: () => new Date(),
    }),
    searchEntries: createSearchEntries({ entries, accounts }),
    editEntry: createEditEntry({
      entries,
      accounts,
      unitOfWork: createPostgresUnitOfWork(databaseUrl, logger),
      newEntryId: () => entryIdSchema.parse(uuidv7()),
      now: () => new Date(),
    }),
    deleteEntry: createDeleteEntry({
      entries,
      newEntryId: () => entryIdSchema.parse(uuidv7()),
      now: () => new Date(),
    }),
    getChart: createGetChart({ accounts }),
    addAccount: createAddAccount({ accounts, newAccountId }),
    editAccount: createEditAccount({ accounts }),
    addAccountGroup: createAddAccountGroup({
      accounts,
      newAccountGroupId: () => accountGroupIdSchema.parse(uuidv7()),
    }),
    editAccountGroup: createEditAccountGroup({ accounts }),
    deleteAccount: createDeleteAccount({ accounts }),
    deleteAccountGroup: createDeleteAccountGroup({ accounts }),
    moveChartNode: createMoveChartNode({ accounts }),
    getSettings: createGetSettings({ settings }),
    changeEntryFormMode: createChangeEntryFormMode({ settings }),
    resolveSession: createResolveSession({ sessions, hashSessionToken, now: () => new Date() }),
    beginGoogleSignIn: createBeginGoogleSignIn({ google: googleSignIn }),
    finishGoogleSignIn: createFinishGoogleSignIn({ ...signIn, google: googleSignIn }),
    testSignInOffered: testSignIn,
    testSignIn: testSignIn ? createTestSignIn(signIn) : noTestSignIn,
    signOut: createSignOut({ sessions, hashSessionToken }),
  };
}

let cached: Container | undefined;

export function getContainer(): Container {
  cached ??= createContainer(parseEnv(process.env));
  return cached;
}
