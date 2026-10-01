import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  type Account,
  AMOUNT,
  entrySearchForm,
  expectDebitAndCreditColumns,
  fixToday,
  PHONE,
  postEntries,
  TWELVE_THOUSAND_FIVE_HUNDRED,
  type TwoLineEntry,
} from './entries';
import { signIn, signInForSmoke } from './session';

const SEARCH = '/entries/search';

const WITHOUT_QUERY = /\/entries\/search$/;

const WITH_QUERY = /\/entries\/search\?.+$/;

const TODAY = '2026-09-15';

const PLUS_MINUS = '\u00B1';

const EARLIEST = '2000-01-01';

const LATEST = '2099-12-31';

type Category = 'Year' | 'Quarter' | 'Month' | 'Relative';

const posting = (
  debitAccount: Account,
  creditAccount: Account,
): Pick<TwoLineEntry, 'debitAccount' | 'creditAccount' | 'amount'> => ({
  debitAccount,
  creditAccount,
  amount: AMOUNT,
});

const results = (page: Page): Locator => page.getByRole('region', { name: 'Results' });

const resultFor = (page: Page, memo: string): Locator =>
  results(page).getByTestId('entry').filter({ hasText: memo });

const from = (page: Page): Locator => entrySearchForm(page).getByLabel('From', { exact: true });

const to = (page: Page): Locator => entrySearchForm(page).getByLabel('To', { exact: true });

const datePresets = (page: Page): Locator =>
  page.getByRole('group', { name: 'Date presets', exact: true });

const category = (page: Page, name: Category): Locator =>
  datePresets(page).getByRole('button', { name, exact: true });

const choice = (scope: Page | Locator, name: string): Locator =>
  scope.getByRole('button', { name, exact: true });

type Criteria = {
  readonly from?: string;
  readonly to?: string;
  readonly account?: string;
  readonly memo?: string;
};

async function search(page: Page, criteria: Criteria): Promise<void> {
  const form = entrySearchForm(page);
  await expect(form).toBeVisible();

  await from(page).fill(criteria.from ?? EARLIEST);
  await to(page).fill(criteria.to ?? LATEST);
  if (criteria.account !== undefined) {
    await form.getByLabel('Account', { exact: true }).selectOption(criteria.account);
  }
  if (criteria.memo !== undefined) {
    await form.getByLabel('Memo', { exact: true }).fill(criteria.memo);
  }

  await form.getByRole('button', { name: 'Search' }).click();
}

async function expectRange(page: Page, first: string, last: string): Promise<void> {
  await expect(from(page)).toHaveValue(first);
  await expect(to(page)).toHaveValue(last);
}

async function choosePreset(page: Page, within: Category, name: string): Promise<void> {
  await category(page, within).click();
  await choice(page, name).click();
}

async function expectNoPresetChosen(page: Page): Promise<void> {
  await expect(page.getByRole('main').locator('[aria-pressed="true"]')).toHaveCount(0);
  for (const name of ['Year', 'Quarter', 'Month', 'Relative'] as const) {
    await expect(category(page, name)).toBeVisible();
  }
}

async function postJuneAndLastYear(page: Page, run: string): Promise<{ june: string; lastYear: string }> {
  const june = `June ${run}`;
  const lastYear = `Last year ${run}`;
  await postEntries(page, [
    { day: '2026-06-10', memo: june, ...posting('Expenses', 'Cash') },
    { day: '2025-12-31', memo: lastYear, ...posting('Expenses', 'Cash') },
  ]);
  return { june, lastYear };
}

async function expectPresetRanSearch(page: Page, listed: string, unlisted: string): Promise<void> {
  await expect(resultFor(page, listed)).toHaveCount(1);
  await expect(resultFor(page, unlisted)).toHaveCount(0);
}

test('opens with no query on the month up to today, filled into From and To, and lists only Entries in it', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const before = `Before the month ${run}`;
  const opening = `Opening day ${run}`;
  const today = `Today ${run}`;
  const after = `Tomorrow ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-08-15', memo: before, ...posting('Expenses', 'Cash') },
    { day: '2026-08-16', memo: opening, ...posting('Expenses', 'Cash') },
    { day: '2026-09-15', memo: today, ...posting('Expenses', 'Cash') },
    { day: '2026-09-16', memo: after, ...posting('Expenses', 'Cash') },
  ]);

  await fixToday(page, TODAY);
  await page.goto(SEARCH);

  await expect(entrySearchForm(page)).toBeVisible();
  await expectRange(page, '2026-08-16', '2026-09-15');
  await expect(page).toHaveURL(WITHOUT_QUERY);

  const openingResult = resultFor(page, opening);
  await expect(openingResult).toHaveCount(1);
  await expect(openingResult).toContainText('2026-08-16');
  await expect(openingResult.getByTestId('entry-line')).toHaveCount(2);
  await expect(openingResult.getByTestId('entry-total')).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expectDebitAndCreditColumns(results(page));

  await expect(resultFor(page, today)).toHaveCount(1);
  await expect(resultFor(page, before)).toHaveCount(0);
  await expect(resultFor(page, after)).toHaveCount(0);
  await expect(page).toHaveURL(WITHOUT_QUERY);
});

test('opens on 31 March with a range from 1 March, as a month back has no 31st', async ({ page }) => {
  const run = randomUUID();
  const february = `End of February ${run}`;
  const march = `First of March ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-02-28', memo: february, ...posting('Expenses', 'Cash') },
    { day: '2026-03-01', memo: march, ...posting('Expenses', 'Cash') },
  ]);

  await fixToday(page, '2026-03-31');
  await page.goto(SEARCH);

  await expectRange(page, '2026-03-01', '2026-03-31');
  await expect(resultFor(page, march)).toHaveCount(1);
  await expect(resultFor(page, february)).toHaveCount(0);
});

test('puts the criteria into the query when the User searches, and a reload keeps them', async ({ page }) => {
  const run = randomUUID();
  const june = `June ${run}`;
  const july = `July ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo: june, ...posting('Expenses', 'Cash') },
    { day: '2026-07-15', memo: july, ...posting('Expenses', 'Cash') },
  ]);

  await fixToday(page, TODAY);
  await page.goto(SEARCH);
  await expect(page).toHaveURL(WITHOUT_QUERY);

  await search(page, { from: '2026-06-01', to: '2026-06-30' });
  await expect(page).toHaveURL(WITH_QUERY);
  await expect(resultFor(page, june)).toHaveCount(1);
  await expect(resultFor(page, july)).toHaveCount(0);

  await page.reload();
  await expect(page).toHaveURL(WITH_QUERY);
  await expectRange(page, '2026-06-01', '2026-06-30');
  await expect(resultFor(page, june)).toHaveCount(1);
  await expect(resultFor(page, july)).toHaveCount(0);
});

test('never searches with From or To emptied', async ({ page }) => {
  const run = randomUUID();
  const recent = `Recent ${run}`;
  const old = `Old ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-09-01', memo: recent, ...posting('Expenses', 'Cash') },
    { day: '2020-01-01', memo: old, ...posting('Expenses', 'Cash') },
  ]);

  await fixToday(page, TODAY);
  await page.goto(SEARCH);
  await expect(resultFor(page, recent)).toHaveCount(1);

  const form = entrySearchForm(page);
  for (const field of [from(page), to(page)]) {
    await field.fill('');
    await form.getByRole('button', { name: 'Search' }).click();
    await expect(resultFor(page, recent)).toHaveCount(1);
    await expect(resultFor(page, old)).toHaveCount(0);
    await page.goto(SEARCH);
  }
});

test('fills From and To from a Year preset and runs the search, emphasising the year of today', async ({ page }) => {
  test.slow();
  await signIn(page);
  const { june, lastYear } = await postJuneAndLastYear(page, randomUUID());

  await fixToday(page, TODAY);
  await page.goto(SEARCH);

  await category(page, 'Year').click();
  for (const year of ['2016', '2025', '2026', '2031']) {
    await expect(choice(page, year)).toBeVisible();
  }
  await expect(choice(page, '2015')).toHaveCount(0);
  await expect(choice(page, '2032')).toHaveCount(0);
  await expect(choice(page, '2026')).toHaveAttribute('aria-current', 'date');
  await expect(choice(page, '2025')).not.toHaveAttribute('aria-current', 'date');

  await choice(page, '2026').click();
  await expectRange(page, '2026-01-01', '2026-12-31');
  await expectPresetRanSearch(page, june, lastYear);
  await expectNoPresetChosen(page);

  await choosePreset(page, 'Year', '2025');
  await expectRange(page, '2025-01-01', '2025-12-31');
  await expectPresetRanSearch(page, lastYear, june);
  await expectNoPresetChosen(page);
});

test('fills From and To from a Quarter preset and runs the search, emphasising the quarter of today', async ({ page }) => {
  test.slow();
  await signIn(page);
  const { june, lastYear } = await postJuneAndLastYear(page, randomUUID());

  await fixToday(page, TODAY);
  await page.goto(SEARCH);

  await category(page, 'Quarter').click();
  for (const quarter of ['Q1 2021', 'Q2 2026', 'Q3 2026', 'Q4 2029']) {
    await expect(choice(page, quarter)).toBeVisible();
  }
  await expect(choice(page, 'Q4 2020')).toHaveCount(0);
  await expect(choice(page, 'Q1 2030')).toHaveCount(0);
  await expect(choice(page, 'Q3 2026')).toHaveAttribute('aria-current', 'date');
  await expect(choice(page, 'Q2 2026')).not.toHaveAttribute('aria-current', 'date');

  await choice(page, 'Q2 2026').click();
  await expectRange(page, '2026-04-01', '2026-06-30');
  await expectPresetRanSearch(page, june, lastYear);
  await expectNoPresetChosen(page);

  await choosePreset(page, 'Quarter', 'Q4 2025');
  await expectRange(page, '2025-10-01', '2025-12-31');
  await expectPresetRanSearch(page, lastYear, june);
  await expectNoPresetChosen(page);
});

test('fills From and To from a Month preset and runs the search, emphasising the month of today', async ({ page }) => {
  test.slow();
  await signIn(page);
  const { june, lastYear } = await postJuneAndLastYear(page, randomUUID());

  await fixToday(page, TODAY);
  await page.goto(SEARCH);

  await category(page, 'Month').click();
  for (const month of ['Jan 2023', 'Jun 2026', 'Sep 2026', 'Dec 2028']) {
    await expect(choice(page, month)).toBeVisible();
  }
  await expect(choice(page, 'Dec 2022')).toHaveCount(0);
  await expect(choice(page, 'Jan 2029')).toHaveCount(0);
  await expect(choice(page, 'Sep 2026')).toHaveAttribute('aria-current', 'date');
  await expect(choice(page, 'Aug 2026')).not.toHaveAttribute('aria-current', 'date');

  await choice(page, 'Jun 2026').click();
  await expectRange(page, '2026-06-01', '2026-06-30');
  await expectPresetRanSearch(page, june, lastYear);
  await expectNoPresetChosen(page);

  await choosePreset(page, 'Month', 'Feb 2028');
  await expectRange(page, '2028-02-01', '2028-02-29');
  await expectNoPresetChosen(page);

  await choosePreset(page, 'Month', 'Dec 2025');
  await expectRange(page, '2025-12-01', '2025-12-31');
  await expectPresetRanSearch(page, lastYear, june);
});

test('fills From and To from a Relative preset and runs the search, emphasising none of them', async ({ page }) => {
  test.slow();
  await signIn(page);
  const { june, lastYear } = await postJuneAndLastYear(page, randomUUID());

  await fixToday(page, TODAY);
  await page.goto(SEARCH);

  const relative = [
    'Last 1 month',
    'Last 3 months',
    'Last 6 months',
    'Last 12 months',
    'Last 24 months',
    'Last 36 months',
    'Next 1 month',
    'Next 3 months',
    'Next 6 months',
    'Next 12 months',
    `${PLUS_MINUS}1 month`,
    `${PLUS_MINUS}3 months`,
    `${PLUS_MINUS}6 months`,
    `${PLUS_MINUS}12 months`,
  ];
  await category(page, 'Relative').click();
  for (const name of relative) {
    await expect(choice(page, name)).toBeVisible();
    await expect(choice(page, name)).not.toHaveAttribute('aria-current', /.+/);
  }
  for (const absent of ['Next 24 months', 'Next 36 months', `${PLUS_MINUS}24 months`, 'Last 2 months']) {
    await expect(choice(page, absent)).toHaveCount(0);
  }

  await choice(page, 'Last 6 months').click();
  await expectRange(page, '2026-03-16', '2026-09-15');
  await expectPresetRanSearch(page, june, lastYear);
  await expectNoPresetChosen(page);

  await choosePreset(page, 'Relative', 'Last 1 month');
  await expectRange(page, '2026-08-16', '2026-09-15');
  await expectNoPresetChosen(page);

  await choosePreset(page, 'Relative', 'Next 3 months');
  await expectRange(page, '2026-09-15', '2026-12-14');
  await expectNoPresetChosen(page);

  await choosePreset(page, 'Relative', `${PLUS_MINUS}3 months`);
  await expectRange(page, '2026-06-16', '2026-12-14');
  await expectNoPresetChosen(page);

  await choosePreset(page, 'Relative', 'Last 12 months');
  await expectRange(page, '2025-09-16', '2026-09-15');
  await expect(resultFor(page, lastYear)).toHaveCount(1);
  await expect(resultFor(page, june)).toHaveCount(1);
});

test('opens the presets at 390px from Choose a period, as a full-screen sheet with the four categories as tabs', async ({ page }) => {
  test.slow();
  await signIn(page);
  const { june, lastYear } = await postJuneAndLastYear(page, randomUUID());

  await page.setViewportSize(PHONE);
  await fixToday(page, TODAY);
  await page.goto(SEARCH);

  await expect(entrySearchForm(page)).toBeVisible();
  await expect(datePresets(page)).toBeHidden();

  await page.getByRole('button', { name: 'Choose a period', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Choose a period', exact: true });
  await expect(sheet).toBeVisible();
  await expect.poll(async () => sheet.boundingBox()).toEqual({ x: 0, y: 0, ...PHONE });

  const tabs = sheet.getByRole('tablist');
  for (const name of ['Year', 'Quarter', 'Month', 'Relative']) {
    await expect(tabs.getByRole('tab', { name, exact: true })).toBeVisible();
  }

  await tabs.getByRole('tab', { name: 'Year', exact: true }).click();
  await expect(choice(sheet, '2026')).toHaveAttribute('aria-current', 'date');

  await tabs.getByRole('tab', { name: 'Month', exact: true }).click();
  await expect(choice(sheet, 'Sep 2026')).toHaveAttribute('aria-current', 'date');
  await choice(sheet, 'Jun 2026').click();

  await expect(sheet).toBeHidden();
  await expectRange(page, '2026-06-01', '2026-06-30');
  await expectPresetRanSearch(page, june, lastYear);
  await expect(page.getByRole('main').locator('[aria-pressed="true"]')).toHaveCount(0);
});

test('narrows the results to a day range, both of whose ends are included', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const before = `Last month ${run}`;
  const opening = `Opening day ${run}`;
  const closing = `Closing day ${run}`;
  const after = `Next month ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-05-31', memo: before, ...posting('Expenses', 'Cash') },
    { day: '2026-06-01', memo: opening, ...posting('Expenses', 'Cash') },
    { day: '2026-06-30', memo: closing, ...posting('Expenses', 'Cash') },
    { day: '2026-07-01', memo: after, ...posting('Expenses', 'Cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-01', to: '2026-06-30' });

  await expect(resultFor(page, opening)).toHaveCount(1);
  await expect(resultFor(page, closing)).toHaveCount(1);
  await expect(resultFor(page, before)).toHaveCount(0);
  await expect(resultFor(page, after)).toHaveCount(0);
});

test('matches an Entry through either of its Entry lines', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const debited = `Cash in ${run}`;
  const credited = `Cash out ${run}`;
  const untouched = `No cash ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-10', memo: debited, ...posting('Cash', 'Sales') },
    { day: '2026-06-11', memo: credited, ...posting('Expenses', 'Cash') },
    { day: '2026-06-12', memo: untouched, ...posting('Expenses', 'Accounts payable') },
  ]);

  await page.goto(SEARCH);
  await search(page, { account: 'cash' });

  await expect(resultFor(page, debited)).toHaveCount(1);
  await expect(resultFor(page, credited)).toHaveCount(1);
  await expect(resultFor(page, untouched)).toHaveCount(0);
});

test('narrows the results to a memo substring, ignoring case', async ({ page }) => {
  const run = randomUUID();
  const beans = `Coffee beans ${run}`;
  const fare = `Rail fare ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-10', memo: beans, ...posting('Expenses', 'Cash') },
    { day: '2026-06-11', memo: fare, ...posting('Expenses', 'Cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { memo: 'coffee' });

  await expect(resultFor(page, beans)).toHaveCount(1);
  await expect(resultFor(page, fare)).toHaveCount(0);
});

test('narrows with the day range, the Account and the memo together', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const matching = `Rent June ${run}`;
  const wrongDay = `Rent July ${run}`;
  const wrongAccount = `Rent June on account ${run}`;
  const wrongMemo = `Fuel June ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo: matching, ...posting('Expenses', 'Cash') },
    { day: '2026-07-15', memo: wrongDay, ...posting('Expenses', 'Cash') },
    { day: '2026-06-15', memo: wrongAccount, ...posting('Expenses', 'Accounts payable') },
    { day: '2026-06-15', memo: wrongMemo, ...posting('Expenses', 'Cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-01', to: '2026-06-30', account: 'cash', memo: 'rent' });

  await expect(resultFor(page, matching)).toHaveCount(1);
  await expect(resultFor(page, wrongDay)).toHaveCount(0);
  await expect(resultFor(page, wrongAccount)).toHaveCount(0);
  await expect(resultFor(page, wrongMemo)).toHaveCount(0);
});

test('keeps the criteria it searched with filled into the form', async ({ page }) => {
  const run = randomUUID();
  const memo = `Stationery ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo, ...posting('Expenses', 'Cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-01', to: '2026-06-30', account: 'cash', memo: 'stationery' });

  await expect(resultFor(page, memo)).toHaveCount(1);

  const form = entrySearchForm(page);
  await expectRange(page, '2026-06-01', '2026-06-30');
  await expect(form.getByLabel('Account', { exact: true })).toHaveValue('cash');
  await expect(form.getByLabel('Memo', { exact: true })).toHaveValue('stationery');
});

test('says that nothing matched, rather than rendering an empty region', async ({ page }) => {
  const run = randomUUID();
  const memo = `Ferry ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo, ...posting('Expenses', 'Cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { memo: `absent ${randomUUID()}` });

  await expect(results(page)).toContainText(/match/i);
  await expect(results(page).getByTestId('entry')).toHaveCount(0);
});

test('refuses a reversed day range, explains itself, and shows no list', async ({ page }) => {
  const run = randomUUID();
  const memo = `Ledger ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo, ...posting('Expenses', 'Cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-30', to: '2026-06-01' });

  await expect(page.getByRole('main').getByRole('alert')).toContainText(/range/i);
  await expect(results(page)).toHaveCount(0);
});

test("never shows one User's Entry in another User's results", async ({ browser }) => {
  const memo = `Private ${randomUUID()}`;

  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await signIn(ownerPage);
  await postEntries(ownerPage, [
    { day: '2026-06-15', memo, ...posting('Expenses', 'Cash') },
  ]);
  await ownerPage.goto(SEARCH);
  await search(ownerPage, { memo });
  await expect(resultFor(ownerPage, memo)).toHaveCount(1);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage);
  await otherPage.goto(SEARCH);
  await search(otherPage, { memo });

  await expect(results(otherPage)).toContainText(/match/i);
  await expect(resultFor(otherPage, memo)).toHaveCount(0);

  await owner.close();
  await other.close();
});

test('orders the results as `/entries` does: latest day first, and within a day the latest written', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const writtenFirst = `Morning ${run}`;
  const writtenSecond = `Afternoon ${run}`;
  const laterDay = `Next day ${run}`;

  await signIn(page);
  await postEntries(page, [
    { day: '2026-06-10', memo: writtenFirst, ...posting('Expenses', 'Cash') },
    { day: '2026-06-10', memo: writtenSecond, ...posting('Expenses', 'Cash') },
    { day: '2026-06-11', memo: laterDay, ...posting('Expenses', 'Cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { memo: run });

  const mine = results(page).getByTestId('entry').filter({ hasText: run });
  await expect(mine).toHaveCount(3);
  await expect(mine.nth(0)).toContainText(laterDay);
  await expect(mine.nth(1)).toContainText(writtenSecond);
  await expect(mine.nth(2)).toContainText(writtenFirst);
});

test('renders the Entry search page and its form', { tag: '@smoke' }, async ({ page, context, baseURL }) => {
  await signInForSmoke(page, context, baseURL);
  await page.goto(SEARCH);

  await expect(entrySearchForm(page)).toBeVisible();
  await expect(results(page)).toBeVisible();
});
