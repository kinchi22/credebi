import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  type Account,
  AMOUNT,
  entrySearchForm,
  expectDebitAndCreditColumns,
  postEntries,
  TWELVE_THOUSAND_FIVE_HUNDRED,
  type TwoLineEntry,
} from './entries';
import { fromField, resultFor, results, search, toField } from './entry-search';
import { ENTRY_SEARCH_PATH as SEARCH, ENTRY_SEARCH_WITH_QUERY, ENTRY_SEARCH_WITHOUT_QUERY } from './routes';
import { startAccountsOn } from './accounts';
import { signIn, signInForSmoke } from './session';
import { PHONE } from './viewport';

const TODAY = '2026-09-15';

const PLUS_MINUS = '\u00B1';

const CATEGORIES = ['Year', 'Quarter', 'Month', 'Relative'] as const;

type Category = (typeof CATEGORIES)[number];

async function fixToday(page: Page, day: string): Promise<void> {
  await page.clock.setFixedTime(new Date(`${day}T12:00:00`));
}

const posting = (
  debitAccount: Account,
  creditAccount: Account,
): Pick<TwoLineEntry, 'debitAccount' | 'creditAccount' | 'amount'> => ({
  debitAccount,
  creditAccount,
  amount: AMOUNT,
});

const datePresets = (page: Page): Locator =>
  page.getByRole('group', { name: 'Date presets', exact: true });

const category = (page: Page, name: Category): Locator =>
  datePresets(page).getByRole('button', { name, exact: true });

const presetChoice = (scope: Page | Locator, name: string): Locator =>
  scope.getByRole('button', { name, exact: true });

const pressedChoices = (page: Page): Locator =>
  page.getByRole('main').locator('[aria-pressed="true"]');

async function expectRange(page: Page, first: string, last: string): Promise<void> {
  await expect(fromField(page)).toHaveValue(first);
  await expect(toField(page)).toHaveValue(last);
}

async function choosePreset(page: Page, within: Category, name: string): Promise<void> {
  await category(page, within).click();
  await presetChoice(page, name).click();
}

async function expectNoPresetChosen(page: Page): Promise<void> {
  await expect(pressedChoices(page)).toHaveCount(0);
  for (const name of CATEGORIES) {
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
  await startAccountsOn(page);
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
  await expect(page).toHaveURL(ENTRY_SEARCH_WITHOUT_QUERY);

  const openingResult = resultFor(page, opening);
  await expect(openingResult).toHaveCount(1);
  await expect(openingResult).toContainText('2026-08-16');
  await expect(openingResult.getByTestId('entry-line')).toHaveCount(2);
  await expect(openingResult.getByTestId('entry-total')).toContainText(TWELVE_THOUSAND_FIVE_HUNDRED);
  await expectDebitAndCreditColumns(results(page));

  await expect(resultFor(page, today)).toHaveCount(1);
  await expect(resultFor(page, before)).toHaveCount(0);
  await expect(resultFor(page, after)).toHaveCount(0);
  await expect(page).toHaveURL(ENTRY_SEARCH_WITHOUT_QUERY);
});

test('opens on 31 March with a range from 1 March, as a month back has no 31st', async ({ page }) => {
  const run = randomUUID();
  const february = `End of February ${run}`;
  const march = `First of March ${run}`;

  await signIn(page);
  await startAccountsOn(page);
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
  await startAccountsOn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo: june, ...posting('Expenses', 'Cash') },
    { day: '2026-07-15', memo: july, ...posting('Expenses', 'Cash') },
  ]);

  await fixToday(page, TODAY);
  await page.goto(SEARCH);
  await expect(page).toHaveURL(ENTRY_SEARCH_WITHOUT_QUERY);

  await search(page, { from: '2026-06-01', to: '2026-06-30' });
  await expect(page).toHaveURL(ENTRY_SEARCH_WITH_QUERY);
  await expect(resultFor(page, june)).toHaveCount(1);
  await expect(resultFor(page, july)).toHaveCount(0);

  await page.reload();
  await expect(page).toHaveURL(ENTRY_SEARCH_WITH_QUERY);
  await expectRange(page, '2026-06-01', '2026-06-30');
  await expect(resultFor(page, june)).toHaveCount(1);
  await expect(resultFor(page, july)).toHaveCount(0);
});

test('never searches with From or To emptied', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const recent = `Recent ${run}`;
  const old = `Old ${run}`;
  const future = `Future ${run}`;

  await signIn(page);
  await startAccountsOn(page);
  await postEntries(page, [
    { day: '2026-09-01', memo: recent, ...posting('Expenses', 'Cash') },
    { day: '2020-01-01', memo: old, ...posting('Expenses', 'Cash') },
    { day: '2030-01-01', memo: future, ...posting('Expenses', 'Cash') },
  ]);

  await fixToday(page, TODAY);
  for (const field of [fromField, toField]) {
    await page.goto(SEARCH);
    await expect(resultFor(page, recent)).toHaveCount(1);

    await field(page).fill('');
    await entrySearchForm(page).getByRole('button', { name: 'Search' }).click();

    await expect(field(page)).not.toHaveValue('');
    await expect(resultFor(page, recent)).toHaveCount(1);
    await expect(resultFor(page, old)).toHaveCount(0);
    await expect(resultFor(page, future)).toHaveCount(0);
  }
});

test('fills From and To from a Year preset and runs the search, emphasising the year of today', async ({ page }) => {
  test.slow();
  await signIn(page);
  await startAccountsOn(page);
  const { june, lastYear } = await postJuneAndLastYear(page, randomUUID());

  await fixToday(page, TODAY);
  await page.goto(SEARCH);

  await category(page, 'Year').click();
  for (const year of ['2016', '2025', '2026', '2031']) {
    await expect(presetChoice(page, year)).toBeVisible();
  }
  await expect(presetChoice(page, '2015')).toHaveCount(0);
  await expect(presetChoice(page, '2032')).toHaveCount(0);
  await expect(presetChoice(page, '2026')).toHaveAttribute('aria-current', 'date');
  await expect(presetChoice(page, '2025')).not.toHaveAttribute('aria-current', 'date');

  await presetChoice(page, '2026').click();
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
  await startAccountsOn(page);
  const { june, lastYear } = await postJuneAndLastYear(page, randomUUID());

  await fixToday(page, TODAY);
  await page.goto(SEARCH);

  await category(page, 'Quarter').click();
  for (const quarter of ['Q1 2021', 'Q2 2026', 'Q3 2026', 'Q4 2029']) {
    await expect(presetChoice(page, quarter)).toBeVisible();
  }
  await expect(presetChoice(page, 'Q4 2020')).toHaveCount(0);
  await expect(presetChoice(page, 'Q1 2030')).toHaveCount(0);
  await expect(presetChoice(page, 'Q3 2026')).toHaveAttribute('aria-current', 'date');
  await expect(presetChoice(page, 'Q2 2026')).not.toHaveAttribute('aria-current', 'date');

  await presetChoice(page, 'Q2 2026').click();
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
  await startAccountsOn(page);
  const { june, lastYear } = await postJuneAndLastYear(page, randomUUID());

  await fixToday(page, TODAY);
  await page.goto(SEARCH);

  await category(page, 'Month').click();
  for (const month of ['Jan 2023', 'Jun 2026', 'Sep 2026', 'Dec 2028']) {
    await expect(presetChoice(page, month)).toBeVisible();
  }
  await expect(presetChoice(page, 'Dec 2022')).toHaveCount(0);
  await expect(presetChoice(page, 'Jan 2029')).toHaveCount(0);
  await expect(presetChoice(page, 'Sep 2026')).toHaveAttribute('aria-current', 'date');
  await expect(presetChoice(page, 'Aug 2026')).not.toHaveAttribute('aria-current', 'date');

  await presetChoice(page, 'Jun 2026').click();
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
  await startAccountsOn(page);
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
    await expect(presetChoice(page, name)).toBeVisible();
    await expect(presetChoice(page, name)).not.toHaveAttribute('aria-current', /.+/);
  }
  for (const absent of ['Next 24 months', 'Next 36 months', `${PLUS_MINUS}24 months`, 'Last 2 months']) {
    await expect(presetChoice(page, absent)).toHaveCount(0);
  }

  await presetChoice(page, 'Last 6 months').click();
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
  await startAccountsOn(page);
  const { june, lastYear } = await postJuneAndLastYear(page, randomUUID());

  await page.setViewportSize(PHONE);
  await fixToday(page, TODAY);
  await page.goto(SEARCH);

  await expect(entrySearchForm(page)).toBeVisible();
  await expect(datePresets(page)).toBeHidden();

  await page.getByRole('button', { name: 'Choose a period', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Choose a period', exact: true });
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box?.x ?? Number.NaN).toBeCloseTo(0, 0);
  expect(box?.y ?? Number.NaN).toBeCloseTo(0, 0);
  expect(box?.width ?? Number.NaN).toBeCloseTo(PHONE.width, 0);
  expect(box?.height ?? Number.NaN).toBeCloseTo(PHONE.height, 0);

  const tabs = sheet.getByRole('tablist');
  for (const name of CATEGORIES) {
    await expect(tabs.getByRole('tab', { name, exact: true })).toBeVisible();
  }

  await tabs.getByRole('tab', { name: 'Year', exact: true }).click();
  await expect(presetChoice(sheet, '2026')).toHaveAttribute('aria-current', 'date');

  await tabs.getByRole('tab', { name: 'Month', exact: true }).click();
  await expect(presetChoice(sheet, 'Sep 2026')).toHaveAttribute('aria-current', 'date');
  await presetChoice(sheet, 'Jun 2026').click();

  await expect(sheet).toBeHidden();
  await expectRange(page, '2026-06-01', '2026-06-30');
  await expectPresetRanSearch(page, june, lastYear);
  await expect(pressedChoices(page)).toHaveCount(0);
});

test('narrows the results to a day range, both of whose ends are included', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const before = `Last month ${run}`;
  const opening = `Opening day ${run}`;
  const closing = `Closing day ${run}`;
  const after = `Next month ${run}`;

  await signIn(page);
  await startAccountsOn(page);
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
  await startAccountsOn(page);
  await postEntries(page, [
    { day: '2026-06-10', memo: debited, ...posting('Cash', 'Sales') },
    { day: '2026-06-11', memo: credited, ...posting('Expenses', 'Cash') },
    { day: '2026-06-12', memo: untouched, ...posting('Expenses', 'Accounts payable') },
  ]);

  await page.goto(SEARCH);
  await search(page, { account: 'Cash' });

  await expect(resultFor(page, debited)).toHaveCount(1);
  await expect(resultFor(page, credited)).toHaveCount(1);
  await expect(resultFor(page, untouched)).toHaveCount(0);
});

test('narrows the results to a memo substring, ignoring case', async ({ page }) => {
  const run = randomUUID();
  const beans = `Coffee beans ${run}`;
  const fare = `Rail fare ${run}`;

  await signIn(page);
  await startAccountsOn(page);
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
  await startAccountsOn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo: matching, ...posting('Expenses', 'Cash') },
    { day: '2026-07-15', memo: wrongDay, ...posting('Expenses', 'Cash') },
    { day: '2026-06-15', memo: wrongAccount, ...posting('Expenses', 'Accounts payable') },
    { day: '2026-06-15', memo: wrongMemo, ...posting('Expenses', 'Cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-01', to: '2026-06-30', account: 'Cash', memo: 'rent' });

  await expect(resultFor(page, matching)).toHaveCount(1);
  await expect(resultFor(page, wrongDay)).toHaveCount(0);
  await expect(resultFor(page, wrongAccount)).toHaveCount(0);
  await expect(resultFor(page, wrongMemo)).toHaveCount(0);
});

test('keeps the criteria it searched with filled into the form', async ({ page }) => {
  const run = randomUUID();
  const memo = `Stationery ${run}`;

  await signIn(page);
  await startAccountsOn(page);
  await postEntries(page, [
    { day: '2026-06-15', memo, ...posting('Expenses', 'Cash') },
  ]);

  await page.goto(SEARCH);
  await search(page, { from: '2026-06-01', to: '2026-06-30', account: 'Cash', memo: 'stationery' });

  await expect(resultFor(page, memo)).toHaveCount(1);

  const form = entrySearchForm(page);
  await expectRange(page, '2026-06-01', '2026-06-30');
  await expect(form.getByLabel('Account', { exact: true }).locator('option:checked')).toHaveText('Cash');
  await expect(form.getByLabel('Memo', { exact: true })).toHaveValue('stationery');
});

test('says that nothing matched, rather than rendering an empty region', async ({ page }) => {
  const run = randomUUID();
  const memo = `Ferry ${run}`;

  await signIn(page);
  await startAccountsOn(page);
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
  await startAccountsOn(page);
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
  await startAccountsOn(ownerPage);
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
  await startAccountsOn(page);
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
