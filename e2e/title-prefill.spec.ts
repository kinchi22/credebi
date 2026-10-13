import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountChoice,
  accountChoices,
  accountTick,
  accountTicks,
  addLine,
  amountShown,
  DAY,
  deleteListed,
  entryForm,
  expectOffered,
  fillHeading,
  expectSuggested,
  findAnAccount,
  lineAmount,
  lineGroup,
  lineGroups,
  listedEntry,
  nameOf,
  notActiveMark,
  offeredTitle,
  openEditEntry,
  openEntryForm,
  openTitleField,
  openTwoLineAccountSheet,
  postEntries,
  saveEdit,
  SIDES,
  submit,
  submitMultiLineEntry,
  submitTwoLineEntry,
  titleField,
  titled,
  type Account,
  suggested,
  type Line,
  type MultiLineEntry,
  type Side,
} from './entries';
import {
  addOldWallet,
  BOOKS_OPEN,
  OLD_WALLET,
  WALLET_ENDED,
  WALLET_IN_USE,
  WALLET_STILL_IN_USE,
} from './accounts';
import { backdateEntry, TWO_YEARS_AND_A_DAY, TWO_YEARS_LESS_A_DAY } from './backdate';
import {
  helpTipExplanation,
  followSettingsLink,
  helpTipButton,
  needsMultiLineExplanation,
  NEEDS_MULTI_LINE_MODE,
  notActiveExplanation,
  NOT_ACTIVE_ON_THIS_DAY,
  openHelpTip,
  settingsLink,
} from './help-tip';
import { signIn } from './session';
import { entryFormModeChoice, setEntryFormMode } from './settings';
import { PHONE } from './viewport';

const LATER_DAY = '2026-09-25';

const WALLET = nameOf(OLD_WALLET);

async function postMultiLine(page: Page, entry: MultiLineEntry): Promise<void> {
  const form = await openEntryForm(page, 'Multi-line mode');
  await submitMultiLineEntry(form, entry);
  await expect(listedEntry(page, entry.memo)).toHaveCount(1);
}

async function chooseTitle(form: Locator, title: string): Promise<void> {
  const field = titleField(form);
  await openTitleField(field);
  await offeredTitle(form.page(), title).click();
  await expect(field).toHaveValue(title);
}

async function expectTwoLine(
  form: Locator,
  debit: Account | undefined,
  credit: Account | undefined,
  amount: string,
): Promise<void> {
  for (const [side, account] of [['Debit', debit], ['Credit', credit]] as const) {
    await expect(accountChoices(form, side)).toBeVisible();
    const checked = accountChoices(form, side).getByRole('radio', { checked: true });
    if (account === undefined) {
      await expect(checked).toHaveCount(0);
    } else {
      await expect(accountChoice(form, side, account)).toBeChecked();
    }
  }
  await expect(form.getByLabel('Amount')).toHaveValue(amount);
}

async function expectLines(form: Locator, lines: readonly Line[]): Promise<void> {
  await expect(accountTicks(form, 'Debit')).toBeVisible();
  await expect(lineGroups(form, OLD_WALLET)).toHaveCount(lines.length);
  for (const line of lines) {
    await expect(lineGroup(form, line.side, line.account)).toBeVisible();
    await expect(lineAmount(form, line.side, line.account)).toHaveValue(line.amount);
  }
}

type Listed = { readonly account: string; readonly amount: string };

async function expectListed(
  page: Page,
  memo: string,
  day: string,
  lines: readonly Listed[],
): Promise<void> {
  const entry = listedEntry(page, memo);
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText(day);
  const shown = entry.getByTestId('entry-line');
  await expect(shown).toHaveCount(lines.length);
  for (const [index, line] of lines.entries()) {
    await expect(shown.nth(index)).toContainText(line.account);
    await expect(shown.nth(index)).toContainText(amountShown(line.amount));
  }
}

const SALARY_LINES: readonly Line[] = [
  { side: 'Credit', account: 'Sales', amount: '12500' },
  { side: 'Debit', account: 'Cash', amount: '9000' },
  { side: 'Debit', account: 'Expenses', amount: '3500' },
];

const SALARY_LISTED: readonly Listed[] = [
  { account: 'Cash', amount: '9,000' },
  { account: 'Expenses', amount: '3,500' },
  { account: 'Sales', amount: '12,500' },
];

async function postSalary(page: Page, memo: string): Promise<void> {
  await postMultiLine(page, { day: DAY, title: 'Salary', memo, lines: SALARY_LINES });
}

test('fills empty Two-line mode lines from the Entry carrying the chosen Title, keeping the day and the memo, and posts them', async ({ page }) => {
  const run = randomUUID();
  const memo = `Second coffee ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Starbucks', `First coffee ${run}`, DAY, 'Accounts payable')]);

  const form = await openEntryForm(page, 'Two-line mode');
  await fillHeading(form, { day: LATER_DAY, memo: memo });
  await chooseTitle(form, 'Starbucks');

  await expectTwoLine(form, 'Expenses', 'Accounts payable', '12500');
  await expect(form.getByLabel('Date')).toHaveValue(LATER_DAY);
  await expect(form.getByLabel('Memo')).toHaveValue(memo);

  await submit(form);
  await expectListed(page, memo, LATER_DAY, [
    { account: 'Expenses', amount: '12,500' },
    { account: 'Accounts payable', amount: '12,500' },
  ]);
});

test('fills an empty Multi-line mode form with every line of the Entry carrying the chosen Title, keeping the day and the memo, and posts them', async ({ page }) => {
  const run = randomUUID();
  const memo = `October pay ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postSalary(page, `September pay ${run}`);

  const form = await openEntryForm(page, 'Multi-line mode');
  await fillHeading(form, { day: LATER_DAY, memo: memo });
  await chooseTitle(form, 'Salary');

  await expectLines(form, SALARY_LINES);
  await expect(form.getByLabel('Date')).toHaveValue(LATER_DAY);
  await expect(form.getByLabel('Memo')).toHaveValue(memo);

  await submit(form);
  await expectListed(page, memo, LATER_DAY, SALARY_LISTED);
});

test('fills from the most recently created shown Entry carrying the Title, whatever its day, counting a Correction as created when posted, never from a deleted or replaced Entry', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  const oldest = `Oldest coffee ${run}`;
  const first = `First coffee ${run}`;
  const second = `Second coffee ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [
    titled('COFFEE', oldest, '2026-09-10', 'Capital'),
    titled('Coffee', first, '2026-09-20', 'Cash'),
    titled('coffee', second, '2026-09-01', 'Accounts payable'),
  ]);

  await chooseTitle(await openEntryForm(page, 'Two-line mode'), 'coffee');
  await expectTwoLine(entryForm(page), 'Expenses', 'Accounts payable', '12500');

  await correctAmount(page, first, '8000');
  await chooseTitle(entryForm(page), 'Coffee');
  await expectTwoLine(entryForm(page), 'Expenses', 'Cash', '8000');

  await deleteAndReload(page, first);
  await chooseTitle(entryForm(page), 'coffee');
  await expectTwoLine(entryForm(page), 'Expenses', 'Accounts payable', '12500');

  await correctAmount(page, second, '7000');
  await deleteAndReload(page, second);
  await chooseTitle(entryForm(page), 'COFFEE');
  await expectTwoLine(entryForm(page), 'Expenses', 'Capital', '12500');
});

async function correctAmount(page: Page, memo: string, amount: string): Promise<void> {
  await page.reload();
  const correction = await openEditEntry(listedEntry(page, memo));
  await correction.getByLabel('Amount').fill(amount);
  await saveEdit(correction);
  await expect(listedEntry(page, memo).getByTestId('entry-total')).toContainText(amountShown(Number(amount).toLocaleString('en-US')));
}

async function deleteAndReload(page: Page, memo: string): Promise<void> {
  await deleteListed(listedEntry(page, memo));
  await page.reload();
  await expect(entryForm(page)).toBeVisible();
  await expect(listedEntry(page, memo)).toHaveCount(0);
}

test('never fills the lines from a Title typed without being chosen', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Rent', `Flat ${randomUUID()}`)]);

  const form = await openEntryForm(page, 'Two-line mode');
  await titleField(form).fill('Rent');
  await expect(offeredTitle(page, 'Rent')).toBeVisible();
  await form.getByLabel('Memo').click();

  await expectTwoLine(form, undefined, undefined, '');
});

test('leaves Two-line mode lines as they are when a Title is chosen while the form holds an Account or an amount', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Rent', `Flat ${randomUUID()}`)]);

  const withAmount = await openEntryForm(page, 'Two-line mode');
  await withAmount.getByLabel('Amount').fill('500');
  await chooseTitle(withAmount, 'Rent');
  await expectTwoLine(withAmount, undefined, undefined, '500');

  await page.reload();
  const withAccount = entryForm(page);
  await accountChoice(withAccount, 'Debit', 'Sales').check();
  await chooseTitle(withAccount, 'Rent');
  await expectTwoLine(withAccount, 'Sales', undefined, '');
});

test('leaves Multi-line mode lines as they are when a Title is chosen while the form holds a line', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postSalary(page, `Pay ${randomUUID()}`);

  const form = await openEntryForm(page, 'Multi-line mode');
  await accountTick(form, 'Debit', 'Capital').check();
  await chooseTitle(form, 'Salary');

  await expectLines(form, [{ side: 'Debit', account: 'Capital', amount: '' }]);
});

test('fills nothing in Two-line mode from an Entry with more than one line on a Side, says it needs Multi-line mode with a Help tip linking to Settings, clears that when the Title changes, and keeps the Entry form mode', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postSalary(page, `Pay ${randomUUID()}`);
  await postEntries(page, [titled('Rent', `Flat ${randomUUID()}`)]);

  const form = await openEntryForm(page, 'Two-line mode');
  await chooseTitle(form, 'Salary');
  const message = form.getByText(NEEDS_MULTI_LINE_MODE, { exact: true });
  await expect(message).toBeVisible();
  await expectTwoLine(form, undefined, undefined, '');
  await expect(accountTicks(form, 'Debit')).toHaveCount(0);

  const tip = helpTipButton(form, NEEDS_MULTI_LINE_MODE);
  const shown = await openHelpTip(tip, needsMultiLineExplanation('Salary'));
  await expect(settingsLink(shown)).toBeVisible();
  await tip.click();
  await expect(shown).toBeHidden();

  await titleField(form).fill('Salar');
  await expect(titleField(form)).toHaveValue('Salar');
  await expect(message).toBeHidden();

  await chooseTitle(form, 'Rent');
  await expectTwoLine(form, 'Expenses', 'Cash', '12500');
  await expect(message).toBeHidden();

  await page.reload();
  const again = entryForm(page);
  await chooseTitle(again, 'Salary');
  await expect(again.getByText(NEEDS_MULTI_LINE_MODE, { exact: true })).toBeVisible();
  await followSettingsLink(helpTipButton(again, NEEDS_MULTI_LINE_MODE), needsMultiLineExplanation('Salary'));
  await expect(entryFormModeChoice(page, 'Two-line mode')).toBeChecked();
});

const WALLET_LINES: readonly Line[] = [
  { side: 'Debit', account: 'Expenses', amount: '12000' },
  { side: 'Debit', account: OLD_WALLET, amount: '500' },
  { side: 'Credit', account: 'Cash', amount: '12500' },
];

async function prefillWalletLines(page: Page, memo: string): Promise<Locator> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await addOldWallet(page);
  await postMultiLine(page, { day: WALLET_IN_USE, title: 'Allowance', memo: `Pocket ${randomUUID()}`, lines: WALLET_LINES });

  const form = await openEntryForm(page, 'Multi-line mode');
  await fillHeading(form, { day: WALLET_ENDED, memo: memo });
  await chooseTitle(form, 'Allowance');
  await expectLines(form, WALLET_LINES);
  await expect(notActiveMark(lineGroup(form, 'Debit', OLD_WALLET))).toBeVisible();
  await expect(notActiveMark(lineGroup(form, 'Debit', 'Expenses'))).toHaveCount(0);

  await submit(form);
  await expect(form.getByRole('alert')).toBeVisible();
  await expect(listedEntry(page, memo)).toHaveCount(0);
  await expectLines(form, WALLET_LINES);
  return form;
}

test('keeps a filled line whose Account is not active on the day, marked under its line, and posts nothing until that line is removed', async ({ page }) => {
  const memo = `Wallet ${randomUUID()}`;
  const form = await prefillWalletLines(page, memo);

  await lineGroup(form, 'Debit', OLD_WALLET).getByRole('button', { name: 'Remove', exact: true }).click();
  await lineAmount(form, 'Debit', 'Expenses').fill('12500');
  await submit(form);

  await expectListed(page, memo, WALLET_ENDED, [
    { account: 'Expenses', amount: '12,500' },
    { account: 'Cash', amount: '12,500' },
  ]);
});

test('posts every filled line once the day changes to one on which the marked line\'s Account is active', async ({ page }) => {
  const memo = `Wallet ${randomUUID()}`;
  const form = await prefillWalletLines(page, memo);

  await form.getByLabel('Date').fill(WALLET_STILL_IN_USE);
  await expect(notActiveMark(lineGroup(form, 'Debit', OLD_WALLET))).toHaveCount(0);
  await submit(form);

  await expectListed(page, memo, WALLET_STILL_IN_USE, [
    { account: 'Expenses', amount: '12,000' },
    { account: WALLET, amount: '500' },
    { account: 'Cash', amount: '12,500' },
  ]);
});

test('leaves the corrected Entry\'s lines as they are when a Title is chosen in Edit entry, and fills them once every line is removed', async ({ page }) => {
  const run = randomUUID();
  const lunch = `Lunch ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postSalary(page, `Pay ${run}`);
  const lunchLines: readonly Line[] = [
    { side: 'Debit', account: 'Expenses', amount: '8000' },
    { side: 'Credit', account: 'Cash', amount: '8000' },
  ];
  await postMultiLine(page, { day: DAY, title: 'Lunch', memo: lunch, lines: lunchLines });

  const dialog = await openEditEntry(listedEntry(page, lunch));
  await chooseTitle(dialog, 'Salary');
  await expectLines(dialog, lunchLines);

  for (const line of lunchLines) {
    await lineGroup(dialog, line.side, line.account).getByRole('button', { name: 'Remove', exact: true }).click();
  }
  await expect(lineGroups(dialog)).toHaveCount(0);
  await chooseTitle(dialog, 'Salary');
  await expectLines(dialog, SALARY_LINES);
  await expect(dialog.getByLabel('Memo')).toHaveValue(lunch);

  await saveEdit(dialog);
  await expectListed(page, lunch, DAY, SALARY_LISTED);
});

const GROCERIES: readonly [Account, Account][] = [
  ['Capital', 'Cash'],
  ['Expenses', 'Accounts payable'],
  ['Sales', 'Cash'],
  ['Expenses', 'Sales'],
  ['Accounts payable', 'Capital'],
];

const SUGGESTED: Readonly<Record<Side, readonly Account[]>> = {
  Debit: ['Expenses', 'Accounts payable', 'Sales'],
  Credit: ['Cash', 'Capital', 'Sales'],
};

async function postGroceries(page: Page, run: string): Promise<void> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await setEntryFormMode(page, 'Two-line mode');
  for (const [index, [debit, credit]] of GROCERIES.entries()) {
    const memo = `Groceries ${String(index)} ${run}`;
    await page.goto('/entries');
    await submitTwoLineEntry(entryForm(page), {
      day: DAY,
      title: index % 2 === 0 ? 'Groceries' : 'groceries',
      memo,
      debitAccount: debit,
      creditAccount: credit,
      amount: '1000',
    });
    await expect(listedEntry(page, memo)).toHaveCount(1);
  }
}

async function expectGroceriesSuggested(
  scope: Locator,
  pickers: (scope: Locator, side: Side) => Locator,
  role: 'radio' | 'checkbox',
): Promise<void> {
  for (const side of SIDES) {
    await expectSuggested(pickers(scope, side), role, SUGGESTED[side]);
  }
}

test('suggests up to three Accounts per Side while the typed Title matches ignoring case, most often named first and then most recently created, each still in its place below and sharing its chosen state', async ({ page }) => {
  test.slow();
  await postGroceries(page, randomUUID());

  const form = await openEntryForm(page, 'Two-line mode');
  for (const side of SIDES) {
    await expectSuggested(accountChoices(form, side), 'radio', []);
  }
  await titleField(form).fill('GROCERIES');
  await expectGroceriesSuggested(form, accountChoices, 'radio');
  for (const side of SIDES) {
    for (const account of SUGGESTED[side]) {
      await expect(accountChoice(form, side, account)).toBeVisible();
    }
  }

  const sales = suggested(accountChoices(form, 'Debit')).getByRole('radio', { name: 'Sales', exact: true });
  await sales.check();
  await expect(accountChoice(form, 'Debit', 'Sales')).toBeChecked();
  await accountChoice(form, 'Debit', 'Expenses').check();
  await expect(sales).not.toBeChecked();

  await titleField(form).fill('Grocer');
  for (const side of SIDES) {
    await expectSuggested(accountChoices(form, side), 'radio', []);
  }
});

test('suggests Accounts in Multi-line mode, in Edit entry and on the Account sheet at 390px, and hides them while the picker has a query', async ({ page }) => {
  test.slow();
  const run = randomUUID();
  await postGroceries(page, run);

  const multi = await openEntryForm(page, 'Multi-line mode');
  await titleField(multi).fill('Groceries');
  await expectGroceriesSuggested(multi, accountTicks, 'checkbox');
  await findAnAccount(multi).fill('a');
  for (const side of SIDES) {
    await expectSuggested(accountTicks(multi, side), 'checkbox', []);
  }

  await setEntryFormMode(page, 'Two-line mode');
  await page.goto('/entries');
  const dialog = await openEditEntry(listedEntry(page, `Groceries 0 ${run}`));
  await expectGroceriesSuggested(dialog, accountChoices, 'radio');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.setViewportSize(PHONE);
  await page.reload();
  const form = entryForm(page);
  await titleField(form).fill('groceries');
  const sheet = await openTwoLineAccountSheet(form, 'Debit');
  await expectSuggested(accountChoices(sheet, 'Debit'), 'radio', SUGGESTED.Debit);
  await findAnAccount(sheet).fill('s');
  await expectSuggested(accountChoices(sheet, 'Debit'), 'radio', []);
});

test('suggests only Accounts active on the form\'s day, following a change of day', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await addOldWallet(page);
  await postMultiLine(page, { day: WALLET_IN_USE, title: 'Allowance', memo: `Pocket ${randomUUID()}`, lines: WALLET_LINES });

  const form = await openEntryForm(page, 'Multi-line mode');
  await form.getByLabel('Date').fill(WALLET_ENDED);
  await titleField(form).fill('Allowance');
  await expectSuggested(accountTicks(form, 'Debit'), 'checkbox', ['Expenses']);

  await expectSuggested(accountTicks(form, 'Credit'), 'checkbox', ['Cash']);

  await form.getByLabel('Date').fill(WALLET_IN_USE);
  const debits = suggested(accountTicks(form, 'Debit')).getByRole('checkbox');
  await expect(debits).toHaveCount(2);
  await expect(suggested(accountTicks(form, 'Debit')).getByRole('checkbox', { name: WALLET, exact: true })).toBeVisible();
});

test('offers a Title and suggests by it only while an Entry carrying it was created in the last two years, and fills from one created within them', async ({ page }) => {
  const run = randomUUID();
  const old = `Old habit ${run}`;
  const recent = `Recent habit ${run}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await postEntries(page, [titled('Gym', old), titled('Pool', recent, DAY, 'Accounts payable')]);
  await backdateEntry(old, TWO_YEARS_AND_A_DAY);
  await backdateEntry(recent, TWO_YEARS_LESS_A_DAY);

  const form = await openEntryForm(page, 'Two-line mode');
  await openTitleField(titleField(form));
  await expectOffered(page, ['Pool']);

  await titleField(form).fill('Pool');
  await expectSuggested(accountChoices(form, 'Credit'), 'radio', ['Accounts payable']);
  await titleField(form).fill('Gym');
  await expectOffered(page, []);
  await expectSuggested(accountChoices(form, 'Credit'), 'radio', []);
  await expectSuggested(accountChoices(form, 'Debit'), 'radio', []);

  await chooseTitle(form, 'Pool');
  await expectTwoLine(form, 'Expenses', 'Accounts payable', '12500');
});

async function chooseWalletInTwoLine(form: Locator, memo: string): Promise<void> {
  await fillHeading(form, { day: WALLET_IN_USE, memo: memo });
  await accountChoice(form, 'Debit', 'Expenses').check();
  await accountChoice(form, 'Credit', WALLET).check();
  await form.getByLabel('Amount').fill('12500');
}

async function expectWalletSlotMarked(form: Locator): Promise<Locator> {
  const slot = lineGroup(form, 'Credit', OLD_WALLET);
  await expect(slot).toBeVisible();
  await expect(slot).toContainText(WALLET);
  await expect(notActiveMark(slot)).toBeVisible();
  await expect(accountChoice(form, 'Debit', 'Expenses')).toBeChecked();
  await expect(notActiveMark(lineGroup(form, 'Debit', 'Expenses'))).toHaveCount(0);
  await expect(form.getByLabel('Amount')).toHaveValue('12500');
  return slot;
}

async function expectWalletChosenAgain(form: Locator, day: string): Promise<void> {
  await form.getByLabel('Date').fill(day);
  await expect(notActiveMark(lineGroup(form, 'Credit', OLD_WALLET))).toHaveCount(0);
  await expect(accountChoice(form, 'Credit', WALLET)).toBeChecked();
  await expect(accountChoice(form, 'Debit', 'Expenses')).toBeChecked();
}

const WALLET_TWO_LINE: readonly Listed[] = [
  { account: 'Expenses', amount: '12,500' },
  { account: WALLET, amount: '12,500' },
];

async function openTwoLineWithOldWallet(page: Page): Promise<Locator> {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await addOldWallet(page);
  return openEntryForm(page, 'Two-line mode');
}

test('keeps a Two-line mode Account not active on a newly chosen day in its slot, marked with a Help tip linking to Settings, and posts nothing until the day is one it is active on', async ({ page }) => {
  const memo = `Wallet ${randomUUID()}`;
  const form = await openTwoLineWithOldWallet(page);
  await chooseWalletInTwoLine(form, memo);
  await expect(lineGroup(form, 'Credit', OLD_WALLET)).toBeVisible();
  await expect(notActiveMark(lineGroup(form, 'Credit', OLD_WALLET))).toHaveCount(0);

  await form.getByLabel('Date').fill(WALLET_ENDED);
  const slot = await expectWalletSlotMarked(form);
  const shown = await openHelpTip(helpTipButton(slot, NOT_ACTIVE_ON_THIS_DAY), notActiveExplanation(WALLET));
  await expect(settingsLink(shown)).toBeVisible();

  await submit(form);
  await expect(form.getByRole('alert')).toBeVisible();
  await expect(listedEntry(page, memo)).toHaveCount(0);
  await expectWalletSlotMarked(form);

  await expectWalletChosenAgain(form, WALLET_STILL_IN_USE);
  await submit(form);
  await expectListed(page, memo, WALLET_STILL_IN_USE, WALLET_TWO_LINE);
});

test('fills a Two-line mode slot with an Account not active on the form\'s day from the chosen Title, marks it, and posts nothing until the day is one it is active on', async ({ page }) => {
  const run = randomUUID();
  const memo = `Wallet again ${run}`;
  const form = await openTwoLineWithOldWallet(page);
  await titleField(form).fill('Allowance');
  await chooseWalletInTwoLine(form, `Wallet ${run}`);
  await submit(form);
  await expectListed(page, `Wallet ${run}`, WALLET_IN_USE, WALLET_TWO_LINE);

  await page.reload();
  const again = entryForm(page);
  await fillHeading(again, { day: WALLET_ENDED, memo });
  await chooseTitle(again, 'Allowance');
  await expectWalletSlotMarked(again);

  await submit(again);
  await expect(again.getByRole('alert')).toBeVisible();
  await expect(listedEntry(page, memo)).toHaveCount(0);
  await expectWalletSlotMarked(again);

  await expectWalletChosenAgain(again, WALLET_STILL_IN_USE);
  await submit(again);
  await expectListed(page, memo, WALLET_STILL_IN_USE, WALLET_TWO_LINE);
});

test('marks a Two-line mode Account not active on the day in its slot in Edit entry, in place of a message below the form, and saves nothing until the day is one it is active on', async ({ page }) => {
  const memo = `Wallet ${randomUUID()}`;
  const form = await openTwoLineWithOldWallet(page);
  await chooseWalletInTwoLine(form, memo);
  await submit(form);
  await expectListed(page, memo, WALLET_IN_USE, WALLET_TWO_LINE);

  const dialog = await openEditEntry(listedEntry(page, memo));
  await dialog.getByLabel('Date').fill(WALLET_ENDED);
  const slot = await expectWalletSlotMarked(dialog);
  await expect(dialog.getByText(/outside the Active period/)).toHaveCount(0);

  await submit(dialog, 'Save');
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog).toBeVisible();
  await expectListed(page, memo, WALLET_IN_USE, WALLET_TWO_LINE);
  await expectWalletSlotMarked(dialog);

  const shown = await openHelpTip(helpTipButton(slot, NOT_ACTIVE_ON_THIS_DAY), notActiveExplanation(WALLET));
  await expect(settingsLink(shown)).toBeVisible();

  await expectWalletChosenAgain(dialog, WALLET_STILL_IN_USE);
  await saveEdit(dialog);
  await expectListed(page, memo, WALLET_STILL_IN_USE, WALLET_TWO_LINE);
});

test('gives the Multi-line mode mark of an Account not active on the day the same Help tip linking to Settings', async ({ page }) => {
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await addOldWallet(page);
  const form = await openEntryForm(page, 'Multi-line mode');
  await form.getByLabel('Date').fill(WALLET_IN_USE);
  await addLine(form, { side: 'Debit', account: OLD_WALLET, amount: '500' });
  await form.getByLabel('Date').fill(WALLET_ENDED);
  const line = lineGroup(form, 'Debit', OLD_WALLET);
  await expect(notActiveMark(line)).toBeVisible();

  await followSettingsLink(helpTipButton(line, NOT_ACTIVE_ON_THIS_DAY), notActiveExplanation(WALLET));
});

async function markedWalletTip(page: Page): Promise<{ readonly tip: Locator; readonly shown: Locator; readonly form: Locator }> {
  const form = await openTwoLineWithOldWallet(page);
  await chooseWalletInTwoLine(form, `Wallet ${randomUUID()}`);
  await form.getByLabel('Date').fill(WALLET_ENDED);
  const slot = await expectWalletSlotMarked(form);
  const tip = helpTipButton(slot, NOT_ACTIVE_ON_THIS_DAY);
  const shown = helpTipExplanation(page, notActiveExplanation(WALLET));
  await expect(tip).toBeVisible();
  await expect(tip).toHaveAttribute('aria-expanded', 'false');
  await expect(shown).toBeHidden();
  return { tip, shown, form };
}

async function movePointerAway(page: Page): Promise<void> {
  await page.mouse.move(1, 1);
}

test('opens a Help tip on hover and closes it when the pointer leaves, unless a click opened it', async ({ page }) => {
  const { tip, shown } = await markedWalletTip(page);

  await tip.hover();
  await expect(shown).toBeVisible();
  await movePointerAway(page);
  await expect(shown).toBeHidden();

  await tip.click();
  await expect(shown).toBeVisible();
  await expect(tip).toHaveAttribute('aria-expanded', 'true');
  await movePointerAway(page);
  await expect(shown).toBeVisible();

  await tip.click();
  await expect(shown).toBeHidden();
  await expect(tip).toHaveAttribute('aria-expanded', 'false');
});

test('toggles a Help tip with Enter and Space, and closes it with Escape or a click outside', async ({ page }) => {
  const { tip, shown, form } = await markedWalletTip(page);

  await tip.focus();
  await page.keyboard.press('Enter');
  await expect(shown).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(shown).toBeHidden();
  await page.keyboard.press('Space');
  await expect(shown).toBeVisible();
  await page.keyboard.press('Space');
  await expect(shown).toBeHidden();

  await page.keyboard.press('Enter');
  await expect(shown).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(shown).toBeHidden();
  await expect(tip).toHaveAttribute('aria-expanded', 'false');

  await tip.click();
  await expect(shown).toBeVisible();
  await form.getByLabel('Memo').click();
  await expect(shown).toBeHidden();
});

test('toggles a Help tip with a tap', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true });
  try {
    const page = await context.newPage();
    const { tip, shown } = await markedWalletTip(page);

    await tip.tap();
    await expect(shown).toBeVisible();
    await tip.tap();
    await expect(shown).toBeHidden();
  } finally {
    await context.close();
  }
});
