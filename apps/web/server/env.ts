import { type DeploymentIdentity } from '@repo/contracts';

const POSTGRES_PROTOCOLS: readonly string[] = ['postgres:', 'postgresql:'];

const REQUIREMENT = 'a postgres:// or postgresql:// connection string with a host';

const NOT_SET = `DATABASE_URL is not set. It must be ${REQUIREMENT}.`;
const MALFORMED = `DATABASE_URL is not ${REQUIREMENT}.`;

function isPostgresConnectionString(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return POSTGRES_PROTOCOLS.includes(url.protocol) && url.hostname !== '';
}

function required(record: Record<string, string | undefined>, name: string): string {
  const value = record[name];
  if (value === undefined) throw new Error(`${name} is not set.`);
  if (value.trim() === '') throw new Error(`${name} is empty.`);
  return value;
}

function optional(record: Record<string, string | undefined>, name: string): string | null {
  const value = record[name]?.trim() ?? '';
  return value === '' ? null : value;
}

export type Env = {
  readonly databaseUrl: string;
  readonly google: {
    readonly clientId: string;
    readonly clientSecret: string;
  };
  readonly testSignIn: boolean;
  readonly deployment: DeploymentIdentity;
};

const TEST_SIGN_IN_ON_PRODUCTION =
  'AUTH_TEST_LOGIN is set on Production, where the test sign-in must not exist.';

export function parseEnv(record: Record<string, string | undefined>): Env {
  const databaseUrl = record['DATABASE_URL'];

  if (databaseUrl === undefined) throw new Error(NOT_SET);
  if (!isPostgresConnectionString(databaseUrl)) throw new Error(MALFORMED);

  const google = {
    clientId: required(record, 'GOOGLE_CLIENT_ID'),
    clientSecret: required(record, 'GOOGLE_CLIENT_SECRET'),
  };

  const testSignIn = (record['AUTH_TEST_LOGIN'] ?? '') !== '';
  if (testSignIn && record['VERCEL_ENV'] === 'production') {
    throw new Error(TEST_SIGN_IN_ON_PRODUCTION);
  }

  const host = optional(record, 'VERCEL_URL');
  const deployment = {
    id: optional(record, 'VERCEL_DEPLOYMENT_ID'),
    commit: optional(record, 'VERCEL_GIT_COMMIT_SHA'),
    url: host === null ? null : `https://${host}`,
  };

  return { databaseUrl, google, testSignIn, deployment };
}
