import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
  accountsSection,
  accountType,
  activeFrom,
  activeUntil,
  descriptionField,
  drag,
  editAccount,
  expectInGroup,
  expectOrder,
  grip,
  nameField,
  NO_GROUP,
  openEdit,
  remove,
  save,
  showEndedAccounts,
  type AccountType,
} from './accounts';
import { expectReport, showReport } from './assets-and-liabilities';
import { closeDialog } from './dialog';
import {
  accountChoice,
  accountChoices,
  accountTick,
  accountTicks,
  ACCOUNT_GROUPS,
  ACCOUNT_TYPES,
  ACCOUNTS,
  entries,
  listedEntry,
  openEntryForm,
  postEntries,
  SIDES,
  type Account,
  type TwoLineEntry,
} from './entries';
import { expectStatement, showStatement } from './income-statement';
import { expectChartInSettings, INITIAL_CHART, nodesInOrder } from './initial-chart';
import { languageChoice, signOutIn, signUpAfterChoosing, type Language } from './language';
import { ASSETS_AND_LIABILITIES_PATH, INCOME_STATEMENT_PATH, SETTINGS_PATH } from './routes';
import { freshIdentifier, signIn } from './session';

const BACK_THEN = '2026-01-15';

const STARTS_EARLIER = '2026-01-01';

const utcDay = (): string => new Date().toISOString().slice(0, 10);

const INITIAL_ACCOUNTS = ACCOUNT_TYPES.flatMap((type) =>
  nodesInOrder(INITIAL_CHART.en[type])
    .filter(({ kind }) => kind === 'account')
    .map(({ name }) => ({ type, name })),
);

async function openChart(page: Page): Promise<void> {
  await page.goto(SETTINGS_PATH);
  await expect(accountsSection(page)).toBeVisible();
}

async function expectInitialChart(page: Page): Promise<void> {
  await openChart(page);
  await expectChartInSettings(page, 'en', INITIAL_CHART.en);
}

test('gives a new User two Account groups and eight Accounts, under their Account types and groups, in order, each described and editable as its kind, at Settings, and keeps them after a reload', async ({ page }) => {
  await signIn(page);
  await expectInitialChart(page);

  await page.reload();
  await expectChartInSettings(page, 'en', INITIAL_CHART.en);
  await expect(showEndedAccounts(page)).not.toBeChecked();
  await showEndedAccounts(page).check();
  await expectChartInSettings(page, 'en', INITIAL_CHART.en);
});

for (const language of ['en', 'ko', 'ja'] as const) {
  test(`names the initial Accounts and Account groups and describes them in ${language} for a User who signs up in it, and keeps them after a reload`, async ({ page }) => {
    await signUpAfterChoosing(page, language);
    await page.goto(SETTINGS_PATH);

    await expectChartInSettings(page, language, INITIAL_CHART[language]);
    await page.reload();
    await expectChartInSettings(page, language, INITIAL_CHART[language]);
  });
}

const LANGUAGE_CHANGES: readonly (readonly [Language, readonly Language[]])[] = [
  ['ko', ['en', 'ja']],
  ['ja', ['ko', 'en']],
  ['en', ['ja', 'ko']],
];

for (const [signedUpIn, changes] of LANGUAGE_CHANGES) {
  test(`keeps the names and descriptions of a ${signedUpIn} User's initial chart as saved when they change their Language`, async ({ page }) => {
    await signUpAfterChoosing(page, signedUpIn);
    let shown: Language = signedUpIn;
    for (const language of changes) {
      await page.goto(SETTINGS_PATH);
      await languageChoice(page, shown, language).check();
      shown = language;
      await expect(languageChoice(page, shown, language)).toBeChecked();
      await page.reload();

      await expectChartInSettings(page, shown, INITIAL_CHART[signedUpIn]);
    }
  });
}

test('starts a new User with no Entries, and with every initial Account at zero in Assets and liabilities and in the Income statement', async ({ page }) => {
  await signIn(page);
  const today = utcDay();

  await page.goto('/entries');
  await expect(entries(page)).toBeVisible();
  await expect(page.getByTestId('entry')).toHaveCount(0);

  await page.goto(ASSETS_AND_LIABILITIES_PATH);
  await showReport(page, today);
  await expectReport(page, {
    assets: [
      ['Cash and deposits', '0'],
      ['Cash', '0'],
      ['Bank deposits', '0'],
    ],
    totalAssets: '0',
    liabilities: [['Credit card payable', '0']],
    totalLiabilities: '0',
    netWorth: '0',
  });

  await page.goto(INCOME_STATEMENT_PATH);
  await showStatement(page, today, today);
  await expectStatement(page, {
    revenue: [['Salary', '0']],
    totalRevenue: '0',
    expenses: [
      ['Living expenses', '0'],
      ['Food', '0'],
      ['Transportation', '0'],
      ['Other living expenses', '0'],
    ],
    totalExpense: '0',
    netIncome: '0',
  });
});

test('starts each initial Account on the UTC calendar day the User is created, with no end day', async ({ page }) => {
  const before = utcDay();
  await signIn(page);
  const after = utcDay();
  await openChart(page);

  for (const { type, name } of INITIAL_ACCOUNTS) {
    const dialog = await openEdit(page, type, name);
    expect([before, after], name).toContain(await activeFrom(dialog).inputValue());
    await expect(activeUntil(dialog), name).toHaveValue('');
    await closeDialog(dialog);
    await expect(dialog).toBeHidden();
  }
});

test('offers an initial Account for an earlier day once its start day is moved back, and keeps a back-dated Entry posted on it', async ({ page }) => {
  const memo = `Back pay ${randomUUID()}`;
  await signIn(page);
  const form = await openEntryForm(page, 'Two-line mode');
  await form.getByLabel('Date').fill(BACK_THEN);
  for (const name of ['Bank deposits', 'Salary', 'Cash']) {
    await expect(accountChoice(form, 'Debit', name), name).toHaveCount(0);
  }

  await openChart(page);
  await editAccount(page, 'Assets', 'Bank deposits', { activeFrom: STARTS_EARLIER });
  await editAccount(page, 'Revenue', 'Salary', { activeFrom: STARTS_EARLIER });

  await page.goto('/entries');
  await form.getByLabel('Date').fill(BACK_THEN);
  await expect(accountChoice(form, 'Debit', 'Bank deposits')).toHaveCount(1);
  await expect(accountChoice(form, 'Credit', 'Salary')).toHaveCount(1);
  await expect(accountChoice(form, 'Debit', 'Cash')).toHaveCount(0);

  await postEntries(page, [
    { day: BACK_THEN, memo, debitAccount: 'Bank deposits', creditAccount: 'Salary', amount: '300000' },
  ]);
  await page.reload();
  const entry = listedEntry(page, memo);
  await expect(entry).toContainText(BACK_THEN);
  const lines = entry.getByTestId('entry-line');
  await expect(lines.nth(0)).toContainText('Bank deposits');
  await expect(lines.nth(1)).toContainText('Salary');
});

type Recorded = { readonly memo: string; readonly debitAccount: Account; readonly creditAccount: Account; readonly amount: string; readonly shown: string };

test('records a salary receipt, a card purchase and a card payment on the initial Accounts, and reads them back after a reload', async ({ page }) => {
  const run = randomUUID();
  const recorded: readonly Recorded[] = [
    { memo: `Salary paid in ${run}`, debitAccount: 'Bank deposits', creditAccount: 'Salary', amount: '300000', shown: '300,000' },
    { memo: `Groceries on the card ${run}`, debitAccount: 'Food', creditAccount: 'Credit card payable', amount: '45000', shown: '45,000' },
    { memo: `Card bill paid ${run}`, debitAccount: 'Credit card payable', creditAccount: 'Bank deposits', amount: '45000', shown: '45,000' },
  ];
  await signIn(page);
  const day = utcDay();
  const posted: readonly TwoLineEntry[] = recorded.map(({ memo, debitAccount, creditAccount, amount }) => ({
    day,
    memo,
    debitAccount,
    creditAccount,
    amount,
  }));
  await postEntries(page, posted);

  await page.goto('/entries');
  await page.reload();
  for (const { memo, debitAccount, creditAccount, shown } of recorded) {
    const lines = listedEntry(page, memo).getByTestId('entry-line');
    await expect(lines, memo).toHaveCount(2);
    await expect(lines.nth(0)).toContainText(debitAccount);
    await expect(lines.nth(0)).toContainText(shown);
    await expect(lines.nth(1)).toContainText(creditAccount);
    await expect(lines.nth(1)).toContainText(shown);
  }

  await page.goto(ASSETS_AND_LIABILITIES_PATH);
  await showReport(page, day);
  await expectReport(page, {
    assets: [
      ['Cash and deposits', '255,000'],
      ['Cash', '0'],
      ['Bank deposits', '255,000'],
    ],
    totalAssets: '255,000',
    liabilities: [['Credit card payable', '0']],
    totalLiabilities: '0',
    netWorth: '255,000',
  });
});

test('offers every initial Account and no Account group as a choice on either Side, in either Entry form mode', async ({ page }) => {
  await signIn(page);

  const twoLine = await openEntryForm(page, 'Two-line mode');
  for (const side of SIDES) {
    for (const account of ACCOUNTS) {
      await expect(accountChoice(twoLine, side, account), `${side} ${account}`).toHaveCount(1);
    }
    for (const group of ACCOUNT_GROUPS) {
      await expect(accountChoices(twoLine, side).getByRole('radio', { name: group, exact: true })).toHaveCount(0);
      await expect(accountChoices(twoLine, side).getByText(group, { exact: true })).toBeVisible();
    }
  }

  const multiLine = await openEntryForm(page, 'Multi-line mode');
  for (const side of SIDES) {
    for (const account of ACCOUNTS) {
      await expect(accountTick(multiLine, side, account), `${side} ${account}`).toHaveCount(1);
    }
    for (const group of ACCOUNT_GROUPS) {
      await expect(accountTicks(multiLine, side).getByRole('checkbox', { name: group, exact: true })).toHaveCount(0);
      await expect(accountTicks(multiLine, side).getByText(group, { exact: true })).toBeVisible();
    }
  }
});

const EDITED: Readonly<Record<AccountType, readonly string[]>> = {
  Assets: ['Money', 'Bank deposits', 'Cash'],
  Liabilities: ['Credit card payable'],
  Equity: [],
  Revenue: ['Salary'],
  Expenses: ['Groceries'],
};

async function expectEditedChart(page: Page): Promise<void> {
  for (const type of ACCOUNT_TYPES) {
    await expectOrder(accountType(page, type), EDITED[type]);
  }
  const money = await openEdit(page, 'Assets', 'Money', 'group');
  await expect(descriptionField(money)).toHaveValue('Spending money');
  await page.keyboard.press('Escape');
  await expect(money).toBeHidden();
  const groceries = await openEdit(page, 'Expenses', 'Groceries');
  await expect(descriptionField(groceries)).toHaveValue('Supermarket runs');
  await page.keyboard.press('Escape');
  await expect(groceries).toBeHidden();
  await expectInGroup(page, 'Assets', 'Cash', 'Money');
  await expectInGroup(page, 'Assets', 'Bank deposits', 'Money');
  await expectInGroup(page, 'Expenses', 'Groceries', NO_GROUP);
  await showEndedAccounts(page).check();
  for (const type of ACCOUNT_TYPES) {
    await expectOrder(accountType(page, type), EDITED[type]);
  }
}

test('keeps an initial chart the User renamed, described, moved, reordered and removed from, groups included, after a reload and after signing in again, recreating nothing', async ({ page }) => {
  test.slow();
  const identifier = freshIdentifier();
  await signIn(page, { identifier });
  await openChart(page);

  const group = await openEdit(page, 'Assets', 'Cash and deposits', 'group');
  await nameField(group).fill('Money');
  await descriptionField(group).fill('Spending money');
  await save(group);
  const assets = accountType(page, 'Assets');
  await drag(page, grip(assets, 'Bank deposits'), grip(assets, 'Cash'));
  await expect(async () => {
    await page.reload();
    await expectOrder(assets, EDITED.Assets);
  }).toPass({ timeout: 15_000 });
  await editAccount(page, 'Expenses', 'Food', { name: 'Groceries', description: 'Supermarket runs', group: NO_GROUP });
  await remove(page, 'Expenses', 'Transportation');
  await remove(page, 'Expenses', 'Other living expenses');
  await remove(page, 'Expenses', 'Living expenses', 'group');
  await remove(page, 'Equity', 'Opening balance equity');

  await page.reload();
  await expectEditedChart(page);

  await signOutIn(page, 'en');
  await signIn(page, { identifier });
  await openChart(page);
  await expectEditedChart(page);
});

test('leaves an unchanged initial chart exactly as it was when the User signs in again', async ({ page }) => {
  const identifier = freshIdentifier();
  await signIn(page, { identifier });
  await expectInitialChart(page);

  await signOutIn(page, 'en');
  await signIn(page, { identifier });

  await expectInitialChart(page);
});

test("gives each User an initial chart of their own, which another User's edits do not change", async ({ browser }) => {
  const editor = await browser.newContext();
  const editorPage = await editor.newPage();
  await signIn(editorPage);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage);

  await openChart(editorPage);
  await editAccount(editorPage, 'Assets', 'Cash', { name: 'Wallet', description: 'Notes and coins' });
  await remove(editorPage, 'Expenses', 'Transportation');
  await expectOrder(accountType(editorPage, 'Assets'), ['Cash and deposits', 'Wallet', 'Bank deposits']);

  await expectInitialChart(otherPage);
  const later = await browser.newContext();
  const laterPage = await later.newPage();
  await signIn(laterPage);
  await expectInitialChart(laterPage);

  await editor.close();
  await other.close();
  await later.close();
});
