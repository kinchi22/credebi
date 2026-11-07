import { randomUUID } from 'node:crypto';
import { ACCOUNT_TYPES, type AccountType } from './entries';
import { INITIAL_CHART, namesOf } from './initial-chart';
import {
  accountsOf,
  callTool,
  callToolResponse,
  connectBooks,
  expectInsufficientScope,
  expectToolError,
  expectUnauthorized,
  idOf,
  listAccounts,
  listTools,
  mcpPost,
  postEntry,
  READ_TOOLS,
  searchEntries,
  SEARCH_LIMIT,
  toolError,
  toolValue,
  twoLines,
  uuidV7Like,
  WRITE_TOOLS,
  type McpChartNode,
  type McpEntry,
} from './mcp';
import { connect, expect, originOf, recordOf, test } from './oauth';
import { ENTRIES_URL, SIGN_IN_URL, UUID_V7 } from './routes';
import { BOOKS_OPEN, SESSION_COOKIE, signIn } from './session';

const ACCOUNT_TYPE_OF: Readonly<Record<AccountType, string>> = {
  Assets: 'asset',
  Liabilities: 'liability',
  Equity: 'equity',
  Revenue: 'revenue',
  Expenses: 'expense',
};

const namesInOrder = (chart: readonly McpChartNode[]): readonly string[] =>
  chart.flatMap((node) =>
    node.kind === 'account' ? [node.account.name] : [node.group.name, ...node.accounts.map(({ name }) => name)],
  );

const dayAfter = (start: string, days: number): string => {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

test.describe('lists only the tools a Connection\'s scopes reach', () => {
  test('read', async ({ page, request, client }) => {
    await signIn(page);
    const { tokens } = await connect(page, request, client, { scopes: ['read'] });

    expect(await listTools(request, tokens.accessToken)).toEqual([...READ_TOOLS]);
  });

  test('write', async ({ page, request, client }) => {
    await signIn(page);
    const { tokens } = await connect(page, request, client, { scopes: ['write'] });

    expect(await listTools(request, tokens.accessToken)).toEqual([...WRITE_TOOLS]);
  });

  test('read and write, and no tool that edits, deletes or changes the Chart of accounts or Settings', async ({ page, request, client }) => {
    await signIn(page);
    const { tokens } = await connect(page, request, client);

    expect(await listTools(request, tokens.accessToken)).toEqual([...READ_TOOLS, ...WRITE_TOOLS].sort());
  });
});

test('answers 403 insufficient_scope to a tool outside the Connection\'s scopes', async ({ page, request, client }) => {
  await signIn(page);
  const reader = await connect(page, request, client, { scopes: ['read'] });
  const writer = await connect(page, request, client, { scopes: ['write'] });

  await expectInsufficientScope(
    await callToolResponse(request, reader.tokens.accessToken, 'create_entry', {
      entryDate: '2026-09-15',
      lines: [],
    }),
  );
  await expectInsufficientScope(await callToolResponse(request, writer.tokens.accessToken, 'list_accounts', {}));
});

test('lists the User\'s Accounts and Account groups in Chart of accounts order, each with its type, group, description and Active period', async ({ page, request, client }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const { tokens } = await connect(page, request, client, { scopes: ['read'] });

  const chart = await listAccounts(request, tokens.accessToken);

  const initial = INITIAL_CHART.en;
  expect(namesInOrder(chart)).toEqual(namesOf(initial));
  for (const type of ACCOUNT_TYPES) {
    for (const node of initial[type]) {
      const listed = chart.find((candidate) =>
        candidate.kind === 'account' ? candidate.account.name === node.name : candidate.group.name === node.name,
      );
      expect(listed?.kind, node.name).toBe(node.kind);
      if (listed?.kind === 'group' && node.kind === 'group') {
        expect(listed.group).toMatchObject({ accountType: ACCOUNT_TYPE_OF[type], description: node.description });
        expect(listed.group.id).toMatch(UUID_V7);
        for (const [index, member] of node.members.entries()) {
          expect(listed.accounts[index]).toMatchObject({
            name: member.name,
            description: member.description,
            accountType: ACCOUNT_TYPE_OF[type],
            groupId: listed.group.id,
            activeFrom: BOOKS_OPEN,
            activeUntil: null,
          });
        }
      }
      if (listed?.kind === 'account') {
        expect(listed.account).toMatchObject({
          description: node.description,
          accountType: ACCOUNT_TYPE_OF[type],
          groupId: null,
          activeFrom: BOOKS_OPEN,
          activeUntil: null,
        });
      }
    }
  }
  for (const account of accountsOf(chart)) expect(account.id).toMatch(UUID_V7);
});

test.describe('searches the User\'s Entries', () => {
  test('by a range of days, an Account, a Title and a memo substring, as the web app does', async ({ page, request, client }) => {
    const { token, ids, food, cash } = await connectBooks(page, request, client);
    const run = randomUUID();
    const card = idOf(ids, 'Credit card payable');
    const lunch = await postEntry(request, token, {
      entryDate: '2026-09-10',
      title: 'Lunch',
      memo: `Noodles ${run}`,
      lines: twoLines(food, cash, 9000),
    });
    const dinner = await postEntry(request, token, {
      entryDate: '2026-09-20',
      title: 'Dinner',
      memo: `Curry ${run}`,
      lines: twoLines(food, card, 15000),
    });

    const byMemo = await searchEntries(request, token, { memo: run });
    expect(byMemo).toEqual({ entries: [dinner, lunch], truncated: false });
    expect((await searchEntries(request, token, { memo: `Noodles ${run}` })).entries).toEqual([lunch]);
    expect((await searchEntries(request, token, { memo: run, from: '2026-09-15' })).entries).toEqual([dinner]);
    expect((await searchEntries(request, token, { memo: run, to: '2026-09-15' })).entries).toEqual([lunch]);
    expect((await searchEntries(request, token, { memo: run, account: card })).entries).toEqual([dinner]);
    expect((await searchEntries(request, token, { memo: run, title: 'Lunch' })).entries).toEqual([lunch]);
  });

  test('carrying each Entry\'s id, day, Title, memo, lines with Account names, total and creation time', async ({ page, request, client }) => {
    const { token, food, cash, lines } = await connectBooks(page, request, client);
    const memo = `Groceries ${randomUUID()}`;
    await postEntry(request, token, { entryDate: '2026-09-15', title: 'Market', memo, lines });

    const [found] = (await searchEntries(request, token, { memo })).entries;

    expect(found).toMatchObject({
      entryDate: '2026-09-15',
      title: 'Market',
      memo,
      total: 12500,
      lines: [
        { account: food, accountName: 'Food', side: 'debit', amount: 12500 },
        { account: cash, accountName: 'Cash', side: 'credit', amount: 12500 },
      ],
    });
    expect(found?.id).toMatch(UUID_V7);
    expect(Number.isNaN(Date.parse(found?.createdAt ?? ''))).toBe(false);
  });

  test(`returning the ${String(SEARCH_LIMIT)} most recent and saying it truncated when more match`, async ({ page, request, client }) => {
    test.slow();
    const { token, food, cash } = await connectBooks(page, request, client);
    const run = randomUUID();
    const lines = twoLines(food, cash, 100);
    const start = '2026-01-01';
    for (let day = 0; day <= SEARCH_LIMIT; day += 1) {
      await postEntry(request, token, { entryDate: dayAfter(start, day), memo: `Snack ${run}`, lines });
    }

    const all = await searchEntries(request, token, { memo: run });

    expect(all.truncated).toBe(true);
    expect(all.entries).toHaveLength(SEARCH_LIMIT);
    expect(all.entries[0]?.entryDate).toBe(dayAfter(start, SEARCH_LIMIT));
    expect(all.entries.at(-1)?.entryDate).toBe(dayAfter(start, 1));

    const narrowed = await searchEntries(request, token, { memo: run, from: dayAfter(start, 1) });
    expect(narrowed.truncated).toBe(false);
    expect(narrowed.entries).toHaveLength(SEARCH_LIMIT);
  });
});

test('reads the User\'s Assets and liabilities on a day', async ({ page, request, client }) => {
  const { token, ids, food, cash } = await connectBooks(page, request, client);
  await postEntry(request, token, {
    entryDate: '2026-09-15',
    memo: `Opening ${randomUUID()}`,
    lines: twoLines(cash, idOf(ids, 'Opening balance equity'), 100000),
  });
  await postEntry(request, token, {
    entryDate: '2026-09-16',
    memo: `Lunch ${randomUUID()}`,
    lines: twoLines(food, cash, 12500),
  });

  const report = recordOf(
    await toolValue(request, token, 'get_assets_and_liabilities', { date: '2026-09-16' }),
    'Assets and liabilities',
  );

  expect(report).toMatchObject({
    assets: {
      total: 87500,
      rows: expect.arrayContaining([
        expect.objectContaining({
          kind: 'group',
          name: 'Cash and deposits',
          total: 87500,
          accounts: expect.arrayContaining([
            expect.objectContaining({ kind: 'account', account: cash, name: 'Cash', total: 87500 }),
          ]),
        }),
      ]),
    },
    liabilities: { total: 0 },
    netWorth: 87500,
  });
  expect(
    await toolValue(request, token, 'get_assets_and_liabilities', { date: '2026-09-14' }),
  ).toMatchObject({ assets: { total: 0 }, netWorth: 0 });
});

test('reads the User\'s Income statement for a range of days', async ({ page, request, client }) => {
  const { token, food, lines } = await connectBooks(page, request, client);
  await postEntry(request, token, { entryDate: '2026-09-16', memo: `Lunch ${randomUUID()}`, lines });

  const statement = await toolValue(request, token, 'get_income_statement', {
    from: '2026-09-01',
    to: '2026-09-30',
  });

  expect(statement).toMatchObject({
    revenue: { total: 0 },
    expense: {
      total: 12500,
      rows: expect.arrayContaining([
        expect.objectContaining({
          kind: 'group',
          name: 'Living expenses',
          total: 12500,
          accounts: expect.arrayContaining([
            expect.objectContaining({ kind: 'account', account: food, name: 'Food', total: 12500 }),
          ]),
        }),
      ]),
    },
    netIncome: -12500,
  });
  expect(
    await toolValue(request, token, 'get_income_statement', { from: '2026-10-01', to: '2026-10-31' }),
  ).toMatchObject({ expense: { total: 0 }, netIncome: 0 });
});

test.describe('refuses with INVALID_INPUT, as the web app does', () => {
  test('a search whose range starts after it ends', async ({ page, request, client }) => {
    await signIn(page);
    const { tokens } = await connect(page, request, client, { scopes: ['read'] });

    await toolError(
      request,
      tokens.accessToken,
      'search_entries',
      { from: '2026-09-30', to: '2026-09-01' },
      'INVALID_INPUT',
    );
  });

  test('an Income statement whose range starts after it ends', async ({ page, request, client }) => {
    await signIn(page);
    const { tokens } = await connect(page, request, client, { scopes: ['read'] });

    await toolError(
      request,
      tokens.accessToken,
      'get_income_statement',
      { from: '2026-09-30', to: '2026-09-01' },
      'INVALID_INPUT',
    );
  });

  test('a search by an Account that is not the User\'s', async ({ page, request, client }) => {
    await signIn(page);
    const { tokens } = await connect(page, request, client, { scopes: ['read'] });

    await toolError(request, tokens.accessToken, 'search_entries', { account: uuidV7Like() }, 'INVALID_INPUT');
  });
});

test('keeps each User\'s Connection to that User\'s books, and answers another User\'s id as one that does not exist', async ({ page, browser, request, client }) => {
  const owner = await connectBooks(page, request, client);
  const otherContext = await browser.newContext();
  try {
    const other = await connectBooks(await otherContext.newPage(), request, client);
    const run = randomUUID();
    const unknown = uuidV7Like();
    const posted: McpEntry = await postEntry(request, owner.token, {
      entryDate: '2026-09-15',
      memo: `Private ${run}`,
      lines: owner.lines,
    });

    expect(Object.values(other.ids)).not.toContain(owner.food);
    expect((await searchEntries(request, owner.token, { memo: run })).entries).toEqual([posted]);
    expect((await searchEntries(request, other.token, { memo: run })).entries).toEqual([]);

    const day = { date: '2026-09-15' };
    const month = { from: '2026-09-01', to: '2026-09-30' };
    expect(await toolValue(request, owner.token, 'get_assets_and_liabilities', day)).toMatchObject({
      assets: { total: -12500 },
    });
    expect(await toolValue(request, owner.token, 'get_income_statement', month)).toMatchObject({
      expense: { total: 12500 },
    });
    expect(await toolValue(request, other.token, 'get_assets_and_liabilities', day)).toMatchObject({
      assets: { total: 0 },
      liabilities: { total: 0 },
      netWorth: 0,
    });
    expect(await toolValue(request, other.token, 'get_income_statement', month)).toMatchObject({
      revenue: { total: 0 },
      expense: { total: 0 },
      netIncome: 0,
    });

    const asOwnersAccount = await callTool(request, other.token, 'search_entries', { account: owner.food });
    const asUnknownAccount = await callTool(request, other.token, 'search_entries', { account: unknown });
    expectToolError(asOwnersAccount, 'INVALID_INPUT');
    expect(asOwnersAccount.text.replace(owner.food, unknown)).toBe(asUnknownAccount.text);

    const postOwners = await callTool(request, other.token, 'create_entry', {
      entryDate: '2026-09-15',
      memo: `Intruder ${run}`,
      lines: twoLines(owner.food, other.cash, 100),
    });
    const postUnknown = await callTool(request, other.token, 'create_entry', {
      entryDate: '2026-09-15',
      memo: `Intruder ${run}`,
      lines: twoLines(unknown, other.cash, 100),
    });
    expectToolError(postOwners, 'INVALID_INPUT');
    expect(postOwners.text.replace(owner.food, unknown)).toBe(postUnknown.text);
    expect((await searchEntries(request, owner.token, { memo: run })).entries).toEqual([posted]);
  } finally {
    await otherContext.close();
  }
});

test('never lets an Access token sign a browser in', async ({ page, request, browser, baseURL, client }) => {
  await signIn(page);
  const { tokens } = await connect(page, request, client);
  const visitor = await browser.newContext();
  try {
    await visitor.addCookies([{ name: SESSION_COOKIE, value: tokens.accessToken, url: baseURL ?? '' }]);
    const visitorPage = await visitor.newPage();

    await visitorPage.goto('/entries');

    await expect(visitorPage).toHaveURL(SIGN_IN_URL);
  } finally {
    await visitor.close();
  }
});

test('never takes a Session cookie as an Access token', async ({ page, request, context, baseURL }) => {
  await signIn(page);
  await expect(page).toHaveURL(ENTRIES_URL);
  const session = (await context.cookies()).find(({ name }) => name === SESSION_COOKIE);
  expect(session, 'the signed-in browser holds a Session cookie').toBeDefined();

  await expectUnauthorized(await mcpPost(request, session?.value ?? '', 'tools/list'), originOf(baseURL));
});
