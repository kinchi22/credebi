import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectOnOneRow } from './account-type-cues';
import { addAccount, boxOf, BOOKS_OPEN } from './accounts';
import {
  added,
  DAY,
  entryOn,
  listedEntry,
  openEntryForm,
  postEntries,
  submitMultiLineEntry,
  type Line,
} from './entries';
import {
  chevron,
  expectCompact,
  expectDetailed,
  expectExpanded,
  expectOnOneLine,
  lineOf,
  nameIn,
  type ShownLine,
} from './entry-density';
import { resultFor, search } from './entry-search';
import { ENTRY_SEARCH_PATH, SETTINGS_PATH } from './routes';
import { signIn } from './session';
import { expectWithinPhone, PHONE, WIDE } from './viewport';

const RAKUTEN_BANK = '\uB77C\uCFE0\uD150\uC740\uD589';

const NOMURA_SECURITIES = '\uB178\uBB34\uB77C\uC99D\uAD8C';

const PAYPAY_POINTS = '\uD398\uC774\uD398\uC774\uD3EC\uC778\uD2B8';

const GROCERIES = '\uC2DD\uB8CC\uD488';

const SEVERAL_PER_SIDE: readonly ShownLine[] = [
  { side: 'Debit', name: RAKUTEN_BANK, amount: '12,345,678' },
  { side: 'Debit', name: NOMURA_SECURITIES, amount: '150,000' },
  { side: 'Credit', name: PAYPAY_POINTS, amount: '150,000' },
  { side: 'Credit', name: 'Salary', amount: '12,345,678' },
];

const ONE_PER_SIDE: readonly ShownLine[] = [
  { side: 'Debit', name: GROCERIES, amount: '3,580' },
  { side: 'Credit', name: RAKUTEN_BANK, amount: '3,580' },
];

type Posted = { readonly severalPerSide: string; readonly onePerSide: string };

const asLine = ({ side, name, amount }: ShownLine): Line => ({
  side,
  account: name === 'Salary' ? 'Salary' : added(name),
  amount: amount.replaceAll(',', ''),
});

async function postLongKoreanNames(page: Page): Promise<Posted> {
  const run = randomUUID();
  const posted: Posted = { severalPerSide: `Several ${run}`, onePerSide: `One ${run}` };
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  for (const name of [RAKUTEN_BANK, NOMURA_SECURITIES, PAYPAY_POINTS]) {
    await addAccount(page, 'Assets', { name, activeFrom: BOOKS_OPEN });
  }
  await addAccount(page, 'Expenses', { name: GROCERIES, activeFrom: BOOKS_OPEN });
  await postEntries(page, [entryOn(DAY, posted.onePerSide, added(GROCERIES), added(RAKUTEN_BANK), '3580')]);
  const form = await openEntryForm(page, 'Multi-line mode');
  await submitMultiLineEntry(form, { day: DAY, memo: posted.severalPerSide, lines: SEVERAL_PER_SIDE.map(asLine) });
  await expect(listedEntry(page, posted.severalPerSide)).toHaveCount(1);
  return posted;
}

async function expectRightOf(left: Locator, right: Locator, what: string): Promise<void> {
  const first = await boxOf(left, `${what}: the left one`);
  const second = await boxOf(right, `${what}: the right one`);
  expect(second.x, `${what}: side by side`).toBeGreaterThanOrEqual(first.x + first.width);
}

async function expectNamesReadable(page: Page, entry: Locator, lines: readonly ShownLine[]): Promise<void> {
  await expect(entry).toHaveCount(1);
  await expectWithinPhone(page, entry);
  for (const line of lines) {
    await expectOnOneLine(nameIn(entry, line), `${line.name} on ${line.side}`);
  }
}

async function expectLongNamesOnPhone(page: Page, list: (memo: string) => Locator, posted: Posted): Promise<void> {
  const severalPerSide = list(posted.severalPerSide);
  const onePerSide = list(posted.onePerSide);
  const heading = { day: DAY, memo: posted.severalPerSide };

  for (const [entry, lines] of [
    [severalPerSide, SEVERAL_PER_SIDE],
    [onePerSide, ONE_PER_SIDE],
  ] as const) {
    await expectCompact(entry, lines);
    await expectNamesReadable(page, entry, lines);
  }

  await chevron(severalPerSide, heading).click();
  await expectExpanded(severalPerSide, heading, true);
  await expectDetailed(severalPerSide, SEVERAL_PER_SIDE, 'stacked');
  await expectNamesReadable(page, severalPerSide, SEVERAL_PER_SIDE);
  for (const line of SEVERAL_PER_SIDE) {
    const lineBox = await boxOf(lineOf(severalPerSide, line), `${line.name}'s line`);
    const amountBox = await boxOf(
      lineOf(severalPerSide, line).getByText(line.amount, { exact: true }),
      `${line.name}'s amount`,
    );
    expect(
      amountBox.x + amountBox.width,
      `${line.name}'s amount ends at the line's right edge`,
    ).toBeGreaterThanOrEqual(lineBox.x + lineBox.width - 1);
  }
}

test('keeps each long Korean Account name readable at 390px in the Entries list, compact and expanded, with no horizontal overflow', async ({ page }) => {
  test.slow();
  const posted = await postLongKoreanNames(page);

  await page.setViewportSize(PHONE);
  await page.goto('/entries');

  await expectLongNamesOnPhone(page, (memo) => listedEntry(page, memo), posted);
});

test('keeps each long Korean Account name readable at 390px in Entry search, compact and expanded, with no horizontal overflow', async ({ page }) => {
  test.slow();
  const posted = await postLongKoreanNames(page);

  await page.setViewportSize(PHONE);
  await page.goto(ENTRY_SEARCH_PATH);
  await search(page, {});

  await expectLongNamesOnPhone(page, (memo) => resultFor(page, memo), posted);
});

test('keeps Debit and Credit side by side at 1280px in the Entries list', async ({ page }) => {
  test.slow();
  const posted = await postLongKoreanNames(page);

  await page.setViewportSize(WIDE);
  await page.goto('/entries');

  for (const [memo, lines] of [
    [posted.severalPerSide, SEVERAL_PER_SIDE],
    [posted.onePerSide, ONE_PER_SIDE],
  ] as const) {
    const entry = listedEntry(page, memo);
    await expect(entry).toHaveCount(1);
    const debit = lines.find((line) => line.side === 'Debit');
    const credit = lines.find((line) => line.side === 'Credit');
    if (debit === undefined || credit === undefined) throw new Error('an Entry has a line on each Side');
    await expectRightOf(lineOf(entry, debit), lineOf(entry, credit), `${memo}: Debit and Credit`);
    await expectOnOneRow(nameIn(entry, debit), nameIn(entry, credit), `${memo}: the first line of each Side`);
  }
});
