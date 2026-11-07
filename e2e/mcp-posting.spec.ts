import { randomUUID } from 'node:crypto';
import {
  deleteListed,
  listedEntry,
  MEMO_MAX,
  openEditEntry,
  saveEdit,
  TITLE_MAX,
  TWELVE_THOUSAND_FIVE_HUNDRED,
} from './entries';
import {
  connectBooks,
  createEntry,
  expectNothingPosted,
  expectToolError,
  idOf,
  accountIds,
  postEntry,
  searchEntries,
  twoLines,
  uuidV7Like,
  type ConnectedBooks,
  type McpEntryInput,
} from './mcp';
import { connect, expect, test } from './oauth';
import { ENTRIES_URL, UUID_V7 } from './routes';

const DAY = '2026-09-15';

test('posts an Entry and returns it exactly as a search reads it', async ({ page, request, client }) => {
  const { token, food, cash } = await connectBooks(page, request, client);
  const memo = `Coffee ${randomUUID()}`;

  const posted = await postEntry(request, token, {
    entryDate: DAY,
    title: 'Coffee',
    memo,
    lines: [
      { account: food, side: 'debit', amount: 4500 },
      { account: cash, side: 'credit', amount: 4500 },
    ],
  });

  expect(posted).toMatchObject({
    entryDate: DAY,
    title: 'Coffee',
    memo,
    total: 4500,
    lines: [
      { account: food, accountName: 'Food', side: 'debit', amount: 4500 },
      { account: cash, accountName: 'Cash', side: 'credit', amount: 4500 },
    ],
  });
  expect(posted.id).toMatch(UUID_V7);
  expect((await searchEntries(request, token, { memo })).entries).toEqual([posted]);
});

test('posts an Entry of more than two lines, without a Title or memo', async ({ page, request, client }) => {
  const { token, food, cash } = await connectBooks(page, request, client);
  const transport = idOf(await accountIds(request, token), 'Transportation');
  const day = '2026-09-17';

  const posted = await postEntry(request, token, {
    entryDate: day,
    lines: [
      { account: food, side: 'debit', amount: 3000 },
      { account: transport, side: 'debit', amount: 1500 },
      { account: cash, side: 'credit', amount: 4500 },
    ],
  });

  expect(posted).toMatchObject({ entryDate: day, title: '', memo: '', total: 4500 });
  expect(posted.lines).toHaveLength(3);
  expect((await searchEntries(request, token, { from: day, to: day })).entries).toEqual([posted]);
});

test('shows an MCP-posted Entry at `/entries` like any other, and lets the User delete it there', async ({ page, request, client }) => {
  const { token, lines } = await connectBooks(page, request, client);
  const memo = `Bakery ${randomUUID()}`;
  await postEntry(request, token, { entryDate: DAY, title: 'Bread', memo, lines });

  await page.goto('/entries');
  await expect(page).toHaveURL(ENTRIES_URL);
  const listed = listedEntry(page, memo);
  await expect(listed).toHaveCount(1);
  await expect(listed).toContainText('Bread');
  await expect(listed).toContainText(DAY);
  const shownLines = listed.getByTestId('entry-line');
  await expect(shownLines.nth(0)).toContainText('Food');
  await expect(shownLines.nth(1)).toContainText('Cash');
  await expect(listed.getByTestId('entry-total')).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);

  await deleteListed(listed);

  await expect(listedEntry(page, memo)).toHaveCount(0);
  await page.reload();
  await expect(listedEntry(page, memo)).toHaveCount(0);
  await expectNothingPosted(request, token, memo);
});

test('searches only the corrected Entry once the User corrects an MCP-posted one in the web app, never the Reversal or the Entry it reverses', async ({ page, request, client }) => {
  const { token, lines } = await connectBooks(page, request, client);
  const run = randomUUID();
  const posted = await postEntry(request, token, { entryDate: DAY, memo: `Taxi ${run}`, lines });
  const corrected = `Bus ${run}`;

  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, posted.memo));
  await dialog.getByLabel('Memo').fill(corrected);
  await saveEdit(dialog);
  await expect(listedEntry(page, corrected)).toHaveCount(1);

  const found = (await searchEntries(request, token, { memo: run })).entries;
  expect(found).toHaveLength(1);
  expect(found[0]?.memo).toBe(corrected);
  expect(found[0]?.id).not.toBe(posted.id);
});

test.describe('refuses, posting nothing', () => {
  const refuses = (
    what: string,
    code: string,
    input: (books: ConnectedBooks, memo: string) => McpEntryInput,
  ): void => {
    test(`${what} with ${code}`, async ({ page, request, client }) => {
      const books = await connectBooks(page, request, client);
      const memo = `Refused ${randomUUID()}`;

      expectToolError(await createEntry(request, books.token, input(books, memo)), code);

      await expectNothingPosted(request, books.token, memo);
    });
  };

  refuses('an Entry whose debits and credits differ', 'UNBALANCED', ({ food, cash }, memo) => ({
    entryDate: DAY,
    memo,
    lines: [
      { account: food, side: 'debit', amount: 12500 },
      { account: cash, side: 'credit', amount: 12000 },
    ],
  }));

  refuses('an Entry on a day outside an Account\'s Active period', 'INVALID_INPUT', ({ lines }, memo) => ({
    entryDate: '1999-12-31',
    memo,
    lines,
  }));

  refuses('an Entry naming an Account that is not the User\'s', 'INVALID_INPUT', ({ cash }, memo) => ({
    entryDate: DAY,
    memo,
    lines: twoLines(uuidV7Like(), cash, 12500),
  }));

  refuses('a line whose amount is zero', 'INVALID_INPUT', ({ food, cash }, memo) => ({
    entryDate: DAY,
    memo,
    lines: twoLines(food, cash, 0),
  }));

  refuses('a line whose amount is below zero', 'INVALID_INPUT', ({ food, cash }, memo) => ({
    entryDate: DAY,
    memo,
    lines: twoLines(food, cash, -12500),
  }));

  refuses('an Entry of one line', 'INVALID_INPUT', ({ food }, memo) => ({
    entryDate: DAY,
    memo,
    lines: [{ account: food, side: 'debit', amount: 12500 }],
  }));

  refuses('a Title too long', 'TITLE_TOO_LONG', ({ lines }, memo) => ({
    entryDate: DAY,
    title: 'T'.repeat(TITLE_MAX + 1),
    memo,
    lines,
  }));

  test('a memo too long with MEMO_TOO_LONG', async ({ page, request, client }) => {
    const books = await connectBooks(page, request, client);
    const run = randomUUID();
    const memo = `${run} ${'m'.repeat(MEMO_MAX)}`;

    expectToolError(
      await createEntry(request, books.token, { entryDate: DAY, memo, lines: books.lines }),
      'MEMO_TOO_LONG',
    );

    await expectNothingPosted(request, books.token, run);
  });
});

test.describe('with a Request key', () => {
  test('answers a repeated post with the Entry the first one posted, and posts nothing more', async ({ page, request, client }) => {
    const { token, lines } = await connectBooks(page, request, client);
    const memo = `Retried ${randomUUID()}`;
    const post: McpEntryInput = { entryDate: DAY, memo, lines, requestKey: randomUUID() };

    const first = await postEntry(request, token, post);
    const second = await postEntry(request, token, post);

    expect(second).toEqual(first);
    expect((await searchEntries(request, token, { memo })).entries).toEqual([first]);
  });

  test('refuses with CONFLICT a key already used for other content', async ({ page, request, client }) => {
    const { token, food, cash, lines } = await connectBooks(page, request, client);
    const memo = `Reused ${randomUUID()}`;
    const requestKey = randomUUID();
    const first = await postEntry(request, token, { entryDate: DAY, memo, lines, requestKey });

    expectToolError(
      await createEntry(request, token, {
        entryDate: DAY,
        memo,
        lines: twoLines(food, cash, 9900),
        requestKey,
      }),
      'CONFLICT',
    );

    expect((await searchEntries(request, token, { memo })).entries).toEqual([first]);
  });

  test('refuses with CONFLICT a key whose Entry has since been deleted', async ({ page, request, client }) => {
    const { token, lines } = await connectBooks(page, request, client);
    const memo = `Deleted ${randomUUID()}`;
    const post: McpEntryInput = { entryDate: DAY, memo, lines, requestKey: randomUUID() };
    await postEntry(request, token, post);
    await page.goto('/entries');
    await deleteListed(listedEntry(page, memo));
    await expect(listedEntry(page, memo)).toHaveCount(0);

    expectToolError(await createEntry(request, token, post), 'CONFLICT');

    await expectNothingPosted(request, token, memo);
  });

  test('posts once for the same key sent through two of the User\'s Connections', async ({ page, request, client }) => {
    const { token, lines } = await connectBooks(page, request, client);
    const second = await connect(page, request, client);
    const memo = `Twice ${randomUUID()}`;
    const post: McpEntryInput = { entryDate: DAY, memo, lines, requestKey: randomUUID() };

    const first = await postEntry(request, token, post);
    const again = await postEntry(request, second.tokens.accessToken, post);

    expect(again).toEqual(first);
    expect((await searchEntries(request, token, { memo })).entries).toEqual([first]);
  });

  test('posts for each User who sends the same key', async ({ page, browser, request, client }) => {
    const owner = await connectBooks(page, request, client);
    const otherContext = await browser.newContext();
    try {
      const other = await connectBooks(await otherContext.newPage(), request, client);
      const memo = `Shared key ${randomUUID()}`;
      const requestKey = randomUUID();

      const owners = await postEntry(request, owner.token, { entryDate: DAY, memo, lines: owner.lines, requestKey });
      const others = await postEntry(request, other.token, { entryDate: DAY, memo, lines: other.lines, requestKey });

      expect(others.id).not.toBe(owners.id);
      expect((await searchEntries(request, owner.token, { memo })).entries).toEqual([owners]);
      expect((await searchEntries(request, other.token, { memo })).entries).toEqual([others]);
    } finally {
      await otherContext.close();
    }
  });
});

test.describe('posts two Entries for two alike posts', () => {
  test('without a Request key', async ({ page, request, client }) => {
    const { token, lines } = await connectBooks(page, request, client);
    const memo = `Two coffees ${randomUUID()}`;

    const first = await postEntry(request, token, { entryDate: DAY, memo, lines });
    const second = await postEntry(request, token, { entryDate: DAY, memo, lines });

    expect(second.id).not.toBe(first.id);
    expect((await searchEntries(request, token, { memo })).entries).toHaveLength(2);
  });

  test('with different Request keys', async ({ page, request, client }) => {
    const { token, lines } = await connectBooks(page, request, client);
    const memo = `Two keys ${randomUUID()}`;

    const first = await postEntry(request, token, { entryDate: DAY, memo, lines, requestKey: randomUUID() });
    const second = await postEntry(request, token, { entryDate: DAY, memo, lines, requestKey: randomUUID() });

    expect(second.id).not.toBe(first.id);
    expect((await searchEntries(request, token, { memo })).entries).toHaveLength(2);
  });
});
