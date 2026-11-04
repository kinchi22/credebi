import { randomUUID } from 'node:crypto';
import { type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { ACCOUNT_TYPES, type AccountType } from './entries';
import { INITIAL_CHART, namesOf } from './initial-chart';
import {
  accountIds,
  accountsOf,
  callTool,
  callToolResponse,
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
import { connect, expect, originOf, recordOf, test, type McpClient } from './oauth';
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

async function connectedUser(
  browser: Browser,
  request: APIRequestContext,
  client: McpClient,
): Promise<{ readonly page: Page; readonly token: string }> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const { tokens } = await connect(page, request, client);
  return { page, token: tokens.accessToken };
}

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
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    const { tokens } = await connect(page, request, client);
    const token = tokens.accessToken;
    const run = randomUUID();
    const ids = await accountIds(request, token);
    const food = idOf(ids, 'Food');
    const cash = idOf(ids, 'Cash');
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
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    const { tokens } = await connect(page, request, client);
    const token = tokens.accessToken;
    const memo = `Groceries ${randomUUID()}`;
    const ids = await accountIds(request, token);
    await postEntry(request, token, {
      entryDate: '2026-09-15',
      title: 'Market',
      memo,
      lines: twoLines(idOf(ids, 'Food'), idOf(ids, 'Cash'), 12500),
    });

    const [found] = (await searchEntries(request, token, { memo })).entries;

    expect(found).toMatchObject({
      entryDate: '2026-09-15',
      title: 'Market',
      memo,
      total: 12500,
      lines: [
        { account: idOf(ids, 'Food'), accountName: 'Food', side: 'debit', amount: 12500 },
        { account: idOf(ids, 'Cash'), accountName: 'Cash', side: 'credit', amount: 12500 },
      ],
    });
    expect(found?.id).toMatch(UUID_V7);
    expect(Number.isNaN(Date.parse(found?.createdAt ?? ''))).toBe(false);
  });

  test(`returning the ${String(SEARCH_LIMIT)} most recent and saying it truncated when more match`, async ({ page, request, client }) => {
    test.slow();
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    const { tokens } = await connect(page, request, client);
    const token = tokens.accessToken;
    const run = randomUUID();
    const ids = await accountIds(request, token);
    const lines = twoLines(idOf(ids, 'Food'), idOf(ids, 'Cash'), 100);
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
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const { tokens } = await connect(page, request, client);
  const token = tokens.accessToken;
  const ids = await accountIds(request, token);
  const cash = idOf(ids, 'Cash');
  await postEntry(request, token, {
    entryDate: '2026-09-15',
    memo: `Opening ${randomUUID()}`,
    lines: twoLines(cash, idOf(ids, 'Opening balance equity'), 100000),
  });
  await postEntry(request, token, {
    entryDate: '2026-09-16',
    memo: `Lunch ${randomUUID()}`,
    lines: twoLines(idOf(ids, 'Food'), cash, 12500),
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
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const { tokens } = await connect(page, request, client);
  const token = tokens.accessToken;
  const ids = await accountIds(request, token);
  const food = idOf(ids, 'Food');
  await postEntry(request, token, {
    entryDate: '2026-09-16',
    memo: `Lunch ${randomUUID()}`,
    lines: twoLines(food, idOf(ids, 'Cash'), 12500),
  });

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

test('keeps each User\'s Connection to that User\'s books, and answers another User\'s id as one that does not exist', async ({ browser, request, client }) => {
  const owner = await connectedUser(browser, request, client);
  const other = await connectedUser(browser, request, client);
  const run = randomUUID();
  const ownerIds = await accountIds(request, owner.token);
  const otherIds = await accountIds(request, other.token);
  const ownerFood = idOf(ownerIds, 'Food');
  const unknown = uuidV7Like();
  const posted: McpEntry = await postEntry(request, owner.token, {
    entryDate: '2026-09-15',
    memo: `Private ${run}`,
    lines: twoLines(ownerFood, idOf(ownerIds, 'Cash'), 12500),
  });

  expect(Object.values(otherIds)).not.toContain(ownerFood);
  expect((await searchEntries(request, other.token, { memo: run })).entries).toEqual([]);
  expect((await searchEntries(request, owner.token, { memo: run })).entries).toEqual([posted]);

  const asOwnersAccount = await callTool(request, other.token, 'search_entries', { account: ownerFood });
  const asUnknownAccount = await callTool(request, other.token, 'search_entries', { account: unknown });
  expectToolError(asOwnersAccount, 'INVALID_INPUT');
  expect(asOwnersAccount.text.replace(ownerFood, unknown)).toBe(asUnknownAccount.text);

  const postOwners = await callTool(request, other.token, 'create_entry', {
    entryDate: '2026-09-15',
    memo: `Intruder ${run}`,
    lines: twoLines(ownerFood, idOf(otherIds, 'Cash'), 100),
  });
  const postUnknown = await callTool(request, other.token, 'create_entry', {
    entryDate: '2026-09-15',
    memo: `Intruder ${run}`,
    lines: twoLines(unknown, idOf(otherIds, 'Cash'), 100),
  });
  expectToolError(postOwners, 'INVALID_INPUT');
  expect(postOwners.text.replace(ownerFood, unknown)).toBe(postUnknown.text);
  expect((await searchEntries(request, owner.token, { memo: run })).entries).toEqual([posted]);

  await owner.page.context().close();
  await other.page.context().close();
});

test('never lets an Access token sign a browser in', async ({ page, request, browser, baseURL, client }) => {
  await signIn(page);
  const { tokens } = await connect(page, request, client);
  const visitor = await browser.newContext();
  await visitor.addCookies([{ name: SESSION_COOKIE, value: tokens.accessToken, url: baseURL ?? '' }]);
  const visitorPage = await visitor.newPage();

  await visitorPage.goto('/entries');

  await expect(visitorPage).toHaveURL(SIGN_IN_URL);
  await visitor.close();
});

test('never takes a Session cookie as an Access token', async ({ page, request, context, baseURL }) => {
  await signIn(page);
  await expect(page).toHaveURL(ENTRIES_URL);
  const session = (await context.cookies()).find(({ name }) => name === SESSION_COOKIE);
  expect(session, 'the signed-in browser holds a Session cookie').toBeDefined();

  await expectUnauthorized(await mcpPost(request, session?.value ?? '', 'tools/list'), originOf(baseURL));
});
