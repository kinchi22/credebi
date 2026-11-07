import {
  domainError,
  err,
  ok,
  type AccountGroupId,
  type AccountId,
  type DomainError,
  type EntryId,
  type Money,
  type Result,
  type Scope,
  type UserId,
} from '@repo/contracts';
import {
  type AccessGrant,
  type AssetsAndLiabilities,
  type AuthContext,
  type ChartNode,
  type Entry,
  type IncomeStatement,
} from '@repo/core';
import { describe, expect, it } from 'vitest';
import {
  accessTokenVerifier,
  authContextOf,
  discoveryResponse,
  serveMcp,
  type McpDependencies,
} from './mcp';
import { SEARCH_LIMIT } from './mcp-tools';

const MCP_PATH = '/mcp';

const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource/mcp';

const AUTHORIZATION_SERVER_PATH = '/.well-known/oauth-authorization-server';

const ORIGIN = 'https://books.example';

const PROTOCOL_VERSION = '2026-07-28';

const USER_ID = '01920000-0000-7000-8000-000000000001' as UserId;

const CLIENT_ID = 'https://client.example/client.json';

const UNAVAILABLE = domainError('DEPENDENCY_UNAVAILABLE', 'The database is down.');

const CASH: ChartNode = {
  kind: 'account',
  account: {
    id: '01920000-0000-7000-8000-0000000000a1' as AccountId,
    accountType: 'asset',
    groupId: null,
    name: 'Cash',
    description: 'Notes and coins',
    position: 0,
    activeFrom: '2026-01-01',
    activeUntil: null,
  },
};

const CARDS: ChartNode = {
  kind: 'group',
  group: {
    id: '01920000-0000-7000-8000-0000000000b1' as AccountGroupId,
    accountType: 'liability',
    name: 'Cards',
    description: null,
    position: 1,
  },
  accounts: [
    {
      id: '01920000-0000-7000-8000-0000000000a2' as AccountId,
      accountType: 'liability',
      groupId: '01920000-0000-7000-8000-0000000000b1' as AccountGroupId,
      name: 'Credit card',
      description: null,
      position: 0,
      activeFrom: '2026-01-01',
      activeUntil: '2026-12-31',
    },
  ],
};

const CASH_ID = '01920000-0000-7000-8000-0000000000a1' as AccountId;

const FOOD_ID = '01920000-0000-7000-8000-0000000000a3' as AccountId;

const GROUP_ID = '01920000-0000-7000-8000-0000000000b1' as AccountGroupId;

const won = (amount: number): Money => amount as Money;

function entryOn(day: number): Entry {
  const entryDate = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
  return {
    id: `01920000-0000-7000-8000-${String(day).padStart(12, '0')}` as EntryId,
    entryDate,
    title: 'Lunch',
    memo: `Noodles on ${entryDate}`,
    lines: [
      { account: FOOD_ID, accountName: 'Food', side: 'debit', amount: won(9000) },
      { account: CASH_ID, accountName: 'Cash', side: 'credit', amount: won(9000) },
    ],
    total: won(9000),
    createdAt: new Date(`${entryDate}T03:04:05.678Z`),
  };
}

const entriesNewestFirst = (count: number): readonly Entry[] =>
  Array.from({ length: count }, (_, index) => entryOn(count - index));

const sectionOf = (total: number) => ({
  total: won(total),
  rows: [
    {
      kind: 'group' as const,
      group: GROUP_ID,
      name: 'Cash and deposits',
      total: won(total),
      accounts: [{ kind: 'account' as const, account: CASH_ID, name: 'Cash', total: won(total) }],
    },
  ],
});

const ASSETS_AND_LIABILITIES: Result<AssetsAndLiabilities, DomainError> = ok({
  assets: sectionOf(87500),
  liabilities: { total: won(0), rows: [] },
  netWorth: won(87500),
});

const INCOME_STATEMENT: Result<IncomeStatement, DomainError> = ok({
  revenue: { total: won(0), rows: [] },
  expense: {
    total: won(12500),
    rows: [{ kind: 'account', account: FOOD_ID, name: 'Food', total: won(12500) }],
  },
  netIncome: won(-12500),
});

const grantFor = (scopes: readonly Scope[]): AccessGrant => ({
  auth: { userId: USER_ID, scopes },
  clientId: CLIENT_ID,
  expiresAt: new Date(Date.now() + 3_600_000),
});

const GRANTS: Readonly<Record<string, AccessGrant>> = {
  reader: grantFor(['read']),
  writer: grantFor(['write']),
  both: grantFor(['read', 'write']),
};

type Fakes = McpDependencies & {
  readonly charted: AuthContext[];
  readonly asked: { readonly auth: AuthContext; readonly query: unknown }[];
};

function fakes({
  chart = ok([CASH, CARDS]),
  found = ok([]),
  assetsAndLiabilities = ASSETS_AND_LIABILITIES,
  statement = INCOME_STATEMENT,
  resolved,
}: {
  readonly chart?: Result<readonly ChartNode[], DomainError>;
  readonly found?: Result<readonly Entry[], DomainError>;
  readonly assetsAndLiabilities?: Result<AssetsAndLiabilities, DomainError>;
  readonly statement?: Result<IncomeStatement, DomainError>;
  readonly resolved?: Result<AccessGrant | undefined, DomainError>;
} = {}): Fakes {
  const charted: AuthContext[] = [];
  const asked: { auth: AuthContext; query: unknown }[] = [];
  return {
    charted,
    asked,
    resolveAccessToken: (token) => Promise.resolve(resolved ?? ok(GRANTS[token])),
    getChart: (auth) => {
      charted.push(auth);
      return Promise.resolve(chart);
    },
    searchEntries: (auth, criteria) => {
      asked.push({ auth, query: criteria });
      return Promise.resolve(found);
    },
    getAssetsAndLiabilities: (auth, day) => {
      asked.push({ auth, query: day });
      return Promise.resolve(assetsAndLiabilities);
    },
    getIncomeStatement: (auth, range) => {
      asked.push({ auth, query: range });
      return Promise.resolve(statement);
    },
  };
}

const serving = (dependencies: McpDependencies = fakes()) => serveMcp(() => dependencies);

const get = (path: string, origin = ORIGIN): Request => new Request(`${origin}${path}`);

async function documentAt(path: string, origin = ORIGIN): Promise<Record<string, unknown>> {
  const response = discoveryResponse(get(path, origin));
  expect(response.status).toBe(200);
  return (await response.json()) as Record<string, unknown>;
}

function mcpCall(
  token: string | undefined,
  method: string,
  params: Readonly<Record<string, unknown>> = {},
): Request {
  return new Request(`${ORIGIN}${MCP_PATH}`, {
    method: 'POST',
    headers: {
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': PROTOCOL_VERSION,
      'mcp-method': method,
      ...(typeof params['name'] === 'string' ? { 'mcp-name': params['name'] } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientCapabilities': {},
          'io.modelcontextprotocol/clientInfo': { name: 'unit', version: '1.0.0' },
        },
      },
    }),
  });
}

describe('discoveryResponse', () => {
  it('names the MCP URL as the resource, this origin as its authorization server, and both scopes', async () => {
    expect(await documentAt(PROTECTED_RESOURCE_PATH)).toEqual({
      resource: `${ORIGIN}/mcp`,
      authorization_servers: [ORIGIN],
      scopes_supported: ['read', 'write'],
    });
  });

  it('describes this origin as an authorization server with S256, no client secret, CIMD, iss and no registration', async () => {
    expect(await documentAt(AUTHORIZATION_SERVER_PATH)).toEqual({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
      scopes_supported: ['read', 'write'],
    });
  });

  it('takes every URL from the origin the request reached', async () => {
    const origin = 'https://preview.example';

    expect(await documentAt(PROTECTED_RESOURCE_PATH, origin)).toMatchObject({
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
    });
    expect(await documentAt(AUTHORIZATION_SERVER_PATH, origin)).toMatchObject({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
    });
  });

  it('takes the origin from the host the request was forwarded for, as a proxy in front of the server names it', async () => {
    const request = new Request(`http://localhost:3000${AUTHORIZATION_SERVER_PATH}`, {
      headers: { 'x-forwarded-host': 'books.example', 'x-forwarded-proto': 'https' },
    });

    expect(await discoveryResponse(request).json()).toMatchObject({ issuer: 'https://books.example' });
  });

  it('takes the origin from the Host header when nothing forwarded the request', async () => {
    const request = new Request(`http://localhost:3000${AUTHORIZATION_SERVER_PATH}`, {
      headers: { host: '127.0.0.1:3000' },
    });

    expect(await discoveryResponse(request).json()).toMatchObject({ issuer: 'http://127.0.0.1:3000' });
  });


  it('answers 404 for a path that is neither document', () => {
    expect(discoveryResponse(get('/.well-known/openid-configuration')).status).toBe(404);
  });
});

async function resultOf(response: Response): Promise<Record<string, unknown>> {
  expect(response.status).toBe(200);
  const { result } = (await response.json()) as { result: Record<string, unknown> };
  return result;
}

async function toolNames(token: string, dependencies?: McpDependencies): Promise<string[]> {
  const result = await resultOf(await serving(dependencies)(mcpCall(token, 'tools/list')));
  return (result['tools'] as { name: string }[]).map(({ name }) => name);
}

const callTool = (
  token: string,
  name: string,
  dependencies?: McpDependencies,
  args: Readonly<Record<string, unknown>> = {},
) => serving(dependencies)(mcpCall(token, 'tools/call', { name, arguments: args }));

const READ_TOOLS = ['list_accounts', 'search_entries', 'get_assets_and_liabilities', 'get_income_statement'];

const READ_CALLS: readonly (readonly [string, Readonly<Record<string, unknown>>])[] = [
  ['list_accounts', {}],
  ['search_entries', {}],
  ['get_assets_and_liabilities', { date: '2026-09-16' }],
  ['get_income_statement', { from: '2026-09-01', to: '2026-09-30' }],
];

const postedEntry = (entry: Entry) => ({
  id: entry.id,
  entryDate: entry.entryDate,
  title: entry.title,
  memo: entry.memo,
  lines: entry.lines.map(({ account, accountName, side, amount }) => ({ account, accountName, side, amount })),
  total: entry.total,
  createdAt: entry.createdAt.toISOString(),
});

describe('serveMcp', () => {
  it.each([
    ['no Access token', undefined],
    ['a token that is not live', 'not-a-live-token'],
  ])('answers a call with %s with a challenge naming the protected resource metadata', async (_, token) => {
    const response = await serving()(mcpCall(token, 'tools/list'));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toMatch(
      new RegExp(`^Bearer .*resource_metadata="${ORIGIN}${PROTECTED_RESOURCE_PATH}"`),
    );
  });

  it('names the protected resource metadata at the host the request was forwarded for', async () => {
    const request = new Request(`http://localhost:3000${MCP_PATH}`, {
      method: 'POST',
      headers: { 'x-forwarded-host': 'books.example', 'x-forwarded-proto': 'https' },
    });

    const response = await serving()(request);

    expect(response.headers.get('www-authenticate')).toContain(
      `resource_metadata="https://books.example${PROTECTED_RESOURCE_PATH}"`,
    );
  });

  it('answers 500 when the Access token cannot be looked up', async () => {
    const response = await serving(fakes({ resolved: err(UNAVAILABLE) }))(mcpCall('reader', 'tools/list'));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: 'server_error' });
  });

  it('names itself to a client discovering it', async () => {
    const response = await serving()(mcpCall('reader', 'server/discover'));

    const { result } = (await response.json()) as {
      result: { _meta: Record<string, { name: string; version: string }> };
    };
    expect(result._meta['io.modelcontextprotocol/serverInfo']).toEqual({
      name: 'credebi',
      version: expect.stringMatching(/^\d+\.\d+\.\d+$/) as unknown,
    });
  });

  it('lists the reading tools to a Connection with read', async () => {
    expect(await toolNames('reader')).toEqual(READ_TOOLS);
    expect(await toolNames('both')).toEqual(READ_TOOLS);
  });

  it.each([
    ['list_accounts', /Chart of accounts/, []],
    ['search_entries', /most recent first/, ['from', 'to', 'account', 'title', 'memo']],
    ['get_assets_and_liabilities', /Assets and liabilities/, ['date']],
    ['get_income_statement', /Income statement/, ['from', 'to']],
  ])('describes %s as a read-only tool and the arguments it takes', async (name, description, properties) => {
    const result = await resultOf(await serving()(mcpCall('reader', 'tools/list')));

    const listed = (result['tools'] as { name: string; inputSchema: { properties?: object } }[]).find(
      (tool) => tool.name === name,
    );
    expect(listed).toMatchObject({
      description: expect.stringMatching(description) as unknown,
      inputSchema: { type: 'object' },
      annotations: { readOnlyHint: true },
    });
    expect(Object.keys(listed?.inputSchema.properties ?? {})).toEqual(properties);
  });

  it('lists no reading tool to a Connection with write alone', async () => {
    expect(await toolNames('writer')).toEqual([]);
  });

  it('lists the Chart of accounts of the Access token\'s User, in order', async () => {
    const dependencies = fakes();

    const result = await resultOf(await callTool('reader', 'list_accounts', dependencies));

    const chart = [
      {
        kind: 'account',
        account: {
          id: '01920000-0000-7000-8000-0000000000a1',
          accountType: 'asset',
          groupId: null,
          name: 'Cash',
          description: 'Notes and coins',
          activeFrom: '2026-01-01',
          activeUntil: null,
        },
      },
      {
        kind: 'group',
        group: {
          id: '01920000-0000-7000-8000-0000000000b1',
          accountType: 'liability',
          name: 'Cards',
          description: null,
        },
        accounts: [
          {
            id: '01920000-0000-7000-8000-0000000000a2',
            accountType: 'liability',
            groupId: '01920000-0000-7000-8000-0000000000b1',
            name: 'Credit card',
            description: null,
            activeFrom: '2026-01-01',
            activeUntil: '2026-12-31',
          },
        ],
      },
    ];
    expect(result['structuredContent']).toEqual({ chart });
    expect(result['isError']).toBeUndefined();
    expect(result['content']).toEqual([{ type: 'text', text: JSON.stringify({ chart }) }]);
    expect(dependencies.charted).toEqual([{ userId: USER_ID, scopes: ['read'] }]);
  });

  it('searches the Access token\'s User\'s Entries by the Search criteria it was given', async () => {
    const dependencies = fakes({ found: ok([entryOn(20), entryOn(10)]) });
    const criteria = { from: '2026-09-01', to: '2026-09-30', account: FOOD_ID, title: 'Lunch', memo: 'Noodles' };

    const result = await resultOf(await callTool('reader', 'search_entries', dependencies, criteria));

    const found = { entries: [postedEntry(entryOn(20)), postedEntry(entryOn(10))], truncated: false };
    expect(result['structuredContent']).toEqual(found);
    expect(result['content']).toEqual([{ type: 'text', text: JSON.stringify(found) }]);
    expect(dependencies.asked).toEqual([{ auth: { userId: USER_ID, scopes: ['read'] }, query: criteria }]);
  });

  it('searches with no Search criteria when given none', async () => {
    const dependencies = fakes();

    const result = await resultOf(await callTool('reader', 'search_entries', dependencies));

    expect(result['structuredContent']).toEqual({ entries: [], truncated: false });
    expect(dependencies.asked.map(({ query }) => query)).toEqual([{}]);
  });

  it('caps a search at 100 Entries', () => {
    expect(SEARCH_LIMIT).toBe(100);
  });

  it('answers every Entry found, untruncated, when exactly as many as the cap match', async () => {
    const result = await resultOf(
      await callTool('reader', 'search_entries', fakes({ found: ok(entriesNewestFirst(SEARCH_LIMIT)) })),
    );

    expect(result['structuredContent']).toEqual({
      entries: entriesNewestFirst(SEARCH_LIMIT).map(postedEntry),
      truncated: false,
    });
  });

  it('answers the most recent Entries up to the cap and says it truncated when more match', async () => {
    const found = entriesNewestFirst(SEARCH_LIMIT + 1);

    const result = await resultOf(await callTool('reader', 'search_entries', fakes({ found: ok(found) })));

    expect(result['structuredContent']).toEqual({
      entries: found.slice(0, SEARCH_LIMIT).map(postedEntry),
      truncated: true,
    });
  });

  it('takes an empty Search criterion as one not given, as Entry search on the web does', async () => {
    const dependencies = fakes();

    await resultOf(
      await callTool('reader', 'search_entries', dependencies, { from: '', to: '2026-09-30', account: '', title: '', memo: '' }),
    );

    expect(dependencies.asked.map(({ query }) => query)).toEqual([{ to: '2026-09-30' }]);
  });

  it('reads the Access token\'s User\'s Assets and liabilities on the day it was given', async () => {
    const dependencies = fakes();

    const result = await resultOf(
      await callTool('reader', 'get_assets_and_liabilities', dependencies, { date: '2026-09-16' }),
    );

    expect(result['structuredContent']).toEqual({
      assets: sectionOf(87500),
      liabilities: { total: 0, rows: [] },
      netWorth: 87500,
    });
    expect(dependencies.asked).toEqual([{ auth: { userId: USER_ID, scopes: ['read'] }, query: '2026-09-16' }]);
  });

  it('reads the Access token\'s User\'s Income statement for the inclusive range it was given', async () => {
    const dependencies = fakes();
    const range = { from: '2026-09-01', to: '2026-09-30' };

    const result = await resultOf(await callTool('reader', 'get_income_statement', dependencies, range));

    expect(result['structuredContent']).toEqual({
      revenue: { total: 0, rows: [] },
      expense: {
        total: 12500,
        rows: [{ kind: 'account', account: FOOD_ID, name: 'Food', total: 12500 }],
      },
      netIncome: -12500,
    });
    expect(dependencies.asked).toEqual([{ auth: { userId: USER_ID, scopes: ['read'] }, query: range }]);
  });

  it.each(READ_CALLS)('answers a Domain error from %s as a tool result carrying its code and message', async (name, args) => {
    const refused = fakes({
      chart: err(UNAVAILABLE),
      found: err(UNAVAILABLE),
      assetsAndLiabilities: err(UNAVAILABLE),
      statement: err(UNAVAILABLE),
    });

    const result = await resultOf(await callTool('reader', name, refused, args));

    expect(result['isError']).toBe(true);
    expect(result['structuredContent']).toBeUndefined();
    expect(result['content']).toEqual([
      { type: 'text', text: 'DEPENDENCY_UNAVAILABLE: The database is down.' },
    ]);
  });

  it.each([
    ['search_entries', { from: 'last week' }],
    ['search_entries', { account: 7 }],
    ['get_assets_and_liabilities', {}],
    ['get_assets_and_liabilities', { date: '16 September' }],
    ['get_income_statement', { from: '2026-09-01' }],
  ])('refuses %s arguments %j that are malformed as INVALID_INPUT, reading nothing', async (name, args) => {
    const dependencies = fakes();

    const result = await resultOf(await callTool('reader', name, dependencies, args));

    expect(result['isError']).toBe(true);
    expect(result['content']).toEqual([
      { type: 'text', text: expect.stringMatching(/^INVALID_INPUT: \S/) as unknown },
    ]);
    expect(dependencies.asked).toEqual([]);
  });

  it.each([
    ['get_assets_and_liabilities', { date: '16 September' }, /get_assets_and_liabilities.*date/s],
    ['get_income_statement', { from: '2026-09-01' }, /get_income_statement.*to/s],
  ])('names the tool and the malformed argument when refusing %s', async (name, args, message) => {
    const result = await resultOf(await callTool('reader', name, fakes(), args));

    expect((result['content'] as { text: string }[])[0]?.text).toMatch(message);
  });

  it.each(READ_CALLS)('answers 403 insufficient_scope to %s called with write alone, reading nothing', async (name, args) => {
    const dependencies = fakes();

    const response = await callTool('writer', name, dependencies, args);

    expect(response.status).toBe(403);
    expect(response.headers.get('www-authenticate')).toContain('scope="read"');
    expect([...dependencies.charted, ...dependencies.asked]).toEqual([]);
  });

  it('answers 403 insufficient_scope to a tool outside the Access token\'s scopes, running nothing', async () => {
    const dependencies = fakes();

    const response = await callTool('writer', 'list_accounts', dependencies);

    expect(response.status).toBe(403);
    const challenge = response.headers.get('www-authenticate') ?? '';
    expect(challenge).toContain('error="insufficient_scope"');
    expect(challenge).toContain('scope="read"');
    expect(challenge).toContain(`resource_metadata="${ORIGIN}${PROTECTED_RESOURCE_PATH}"`);
    expect(await response.json()).toEqual({
      error: 'insufficient_scope',
      error_description: 'This tool needs the read scope.',
    });
    expect(dependencies.charted).toEqual([]);
  });

  it('answers 403 insufficient_scope to a batch that calls a tool outside the scopes', async () => {
    const call = (await mcpCall('writer', 'tools/call', { name: 'list_accounts', arguments: {} }).json()) as unknown;
    const request = new Request(`${ORIGIN}${MCP_PATH}`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer writer',
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify([call]),
    });

    expect((await serving()(request)).status).toBe(403);
  });

  it('leaves a tool it does not know to the MCP server, which refuses it as a protocol error', async () => {
    const response = await callTool('reader', 'drop_tables');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ error: { message: expect.stringContaining('drop_tables') as unknown } });
  });

  it('leaves a tool it does not know to the MCP server whatever the scopes', async () => {
    expect((await callTool('writer', 'drop_tables')).status).toBe(200);
  });

  it('leaves a body that is not JSON to the MCP server', async () => {
    const request = new Request(`${ORIGIN}${MCP_PATH}`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer writer',
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: '{not json',
    });

    const response = await serving()(request);

    expect(response.status).toBe(400);
    expect(response.headers.get('www-authenticate')).toBeNull();
  });
});

describe('accessTokenVerifier', () => {
  it('answers a live Access token with its client, scopes, expiry in seconds and User', async () => {
    const expiresAt = new Date('2026-11-07T01:00:00.900Z');
    const verifier = accessTokenVerifier(() =>
      Promise.resolve(ok({ ...grantFor(['read', 'write']), expiresAt })),
    );

    expect(await verifier.verifyAccessToken('the-token')).toEqual({
      token: 'the-token',
      clientId: CLIENT_ID,
      scopes: ['read', 'write'],
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
      extra: { userId: USER_ID },
    });
  });

  it('answers no scope for an Auth context that carries none', async () => {
    const verifier = accessTokenVerifier(() =>
      Promise.resolve(ok({ ...grantFor([]), auth: { userId: USER_ID } })),
    );

    expect(await verifier.verifyAccessToken('the-token')).toMatchObject({ scopes: [] });
  });

  it('refuses a token that is not live as an invalid token', async () => {
    const verifier = accessTokenVerifier(() => Promise.resolve(ok(undefined)));

    await expect(verifier.verifyAccessToken('the-token')).rejects.toMatchObject({
      code: 'invalid_token',
      message: 'This Access token is not live.',
    });
  });

  it('reports a failure to look the token up as a server error', async () => {
    const verifier = accessTokenVerifier(() => Promise.resolve(err(UNAVAILABLE)));

    await expect(verifier.verifyAccessToken('the-token')).rejects.toMatchObject({
      code: 'server_error',
      message: 'The database is down.',
    });
  });
});

describe('authContextOf', () => {
  it('is the User and the scopes the verified Access token carries', () => {
    expect(
      authContextOf({ token: 't', clientId: CLIENT_ID, scopes: ['write', 'read'], extra: { userId: USER_ID } }),
    ).toEqual({ userId: USER_ID, scopes: ['write', 'read'] });
  });

  it('keeps only the scopes it knows', () => {
    expect(
      authContextOf({ token: 't', clientId: CLIENT_ID, scopes: ['admin', 'read'], extra: { userId: USER_ID } }),
    ).toEqual({ userId: USER_ID, scopes: ['read'] });
  });

  it('reaches no User and no scope without a verified Access token', () => {
    expect(authContextOf(undefined)).toEqual({ userId: undefined, scopes: [] });
  });

  it('reaches no User when the token carries something that is not a User id', () => {
    expect(
      authContextOf({ token: 't', clientId: CLIENT_ID, scopes: ['read'], extra: { userId: 'someone' } }),
    ).toEqual({ userId: undefined, scopes: ['read'] });
  });
});
