import { expect, type Locator, type Page } from '@playwright/test';
import { setEntryFormMode } from './settings';

export const AMOUNT = '12500';

export const amountShown = (formatted: string): RegExp =>
  new RegExp(`(?<![\\d,.-])${formatted}(?![\\d,.])`);

export const TWELVE_THOUSAND_FIVE_HUNDRED = amountShown('12,500');

export const DAY = '2026-09-15';

export const ACCOUNTS = ['Cash', 'Accounts payable', 'Capital', 'Sales', 'Expenses'] as const;

export type Account = (typeof ACCOUNTS)[number];

export const SIDES = ['Debit', 'Credit'] as const;

export type Side = (typeof SIDES)[number];

type Heading = {
  readonly day: string;
  readonly memo: string;
};

export type TwoLineEntry = Heading & {
  readonly debitAccount: Account;
  readonly creditAccount: Account;
  readonly amount: string;
};

export type Line = {
  readonly side: Side;
  readonly account: Account;
  readonly amount: string;
};

export type MultiLineEntry = Heading & {
  readonly lines: readonly Line[];
};

export const entryForm = (page: Page): Locator => page.getByRole('form', { name: 'New entry' });

export const entrySearchForm = (page: Page): Locator =>
  page.getByRole('form', { name: 'Search entries' });

export const accountChoices = (form: Locator, side: Side): Locator =>
  form.getByRole('radiogroup', { name: `${side} account`, exact: true });

export const accountChoice = (form: Locator, side: Side, account: Account): Locator =>
  accountChoices(form, side).getByRole('radio', { name: account, exact: true });

export const accountTicks = (form: Locator, side: Side): Locator =>
  form.getByRole('group', { name: `${side} accounts`, exact: true });

export const accountTick = (form: Locator, side: Side, account: Account): Locator =>
  accountTicks(form, side).getByRole('checkbox', { name: account, exact: true });

export const lineGroup = (form: Locator, side: Side, account: Account): Locator =>
  form.getByRole('group', { name: `${side} ${account}`, exact: true });

export const lineGroups = (form: Locator): Locator =>
  form.getByRole('group', {
    name: new RegExp(`^(${SIDES.join('|')}) (${ACCOUNTS.join('|')})$`),
  });

export const addAccountButton = (form: Locator, side: Side): Locator =>
  form.getByRole('button', { name: `Add ${side.toLowerCase()} account`, exact: true });

export const accountSheet = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Choose accounts', exact: true });

export const sheetTab = (sheet: Locator, side: Side): Locator =>
  sheet.getByRole('tablist').getByRole('tab', { name: side, exact: true });

export const findAnAccount = (sheet: Locator): Locator =>
  sheet.getByRole('searchbox', { name: 'Find an account', exact: true });

export async function openAccountSheet(form: Locator, side: Side): Promise<Locator> {
  await addAccountButton(form, side).click();
  const sheet = accountSheet(form.page());
  await expect(sheet).toBeVisible();
  return sheet;
}

export async function closeAccountSheet(sheet: Locator): Promise<void> {
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(sheet).toBeHidden();
}

export async function expectSheetOnSide(sheet: Locator, side: Side): Promise<void> {
  await expect(sheetTab(sheet, side)).toHaveAttribute('aria-selected', 'true');
  await expect(sheetTab(sheet, side === 'Debit' ? 'Credit' : 'Debit')).toHaveAttribute(
    'aria-selected',
    'false',
  );
}

export const listedEntry = (page: Page, memo: string): Locator =>
  page.getByTestId('entry').filter({ hasText: memo });

async function fillHeading(form: Locator, heading: Heading): Promise<void> {
  await form.getByLabel('Date').fill(heading.day);
  await form.getByLabel('Memo').fill(heading.memo);
}

async function submit(form: Locator): Promise<void> {
  await form.getByRole('button', { name: 'Add entry' }).click();
}

export async function submitTwoLineEntry(form: Locator, entry: TwoLineEntry): Promise<void> {
  await fillHeading(form, entry);
  await accountChoice(form, 'Debit', entry.debitAccount).check();
  await accountChoice(form, 'Credit', entry.creditAccount).check();
  await form.getByLabel('Amount').fill(entry.amount);
  await submit(form);
}

export async function submitTwoLineEntryOnPhone(
  form: Locator,
  entry: TwoLineEntry,
): Promise<void> {
  await fillHeading(form, entry);
  const sheet = await openAccountSheet(form, 'Debit');
  await accountChoice(sheet, 'Debit', entry.debitAccount).check();
  await sheetTab(sheet, 'Credit').click();
  await accountChoice(sheet, 'Credit', entry.creditAccount).check();
  await closeAccountSheet(sheet);
  await form.getByLabel('Amount').fill(entry.amount);
  await submit(form);
}

export async function addLineOnPhone(form: Locator, line: Line): Promise<void> {
  const sheet = await openAccountSheet(form, line.side);
  await accountTick(sheet, line.side, line.account).check();
  await closeAccountSheet(sheet);
  await lineGroup(form, line.side, line.account).getByLabel('Amount').fill(line.amount);
}

export async function addLine(form: Locator, line: Line): Promise<void> {
  await accountTick(form, line.side, line.account).check();
  await lineGroup(form, line.side, line.account).getByLabel('Amount').fill(line.amount);
}

async function submitLines(
  form: Locator,
  entry: MultiLineEntry,
  add: (form: Locator, line: Line) => Promise<void>,
): Promise<void> {
  await fillHeading(form, entry);
  for (const line of entry.lines) {
    await add(form, line);
  }
  await submit(form);
}

export async function submitMultiLineEntry(form: Locator, entry: MultiLineEntry): Promise<void> {
  await submitLines(form, entry, addLine);
}

export async function submitMultiLineEntryOnPhone(
  form: Locator,
  entry: MultiLineEntry,
): Promise<void> {
  await submitLines(form, entry, addLineOnPhone);
}

export async function postEntries(page: Page, entries: readonly TwoLineEntry[]): Promise<void> {
  await setEntryFormMode(page, 'Two-line mode');
  for (const entry of entries) {
    await page.goto('/entries');
    await submitTwoLineEntry(entryForm(page), entry);
    await expect(listedEntry(page, entry.memo)).toHaveCount(1);
  }
}

export async function expectDebitAndCreditColumns(list: Locator): Promise<void> {
  await expect(list.getByRole('columnheader', { name: 'Debit', exact: true })).toBeVisible();
  await expect(list.getByRole('columnheader', { name: 'Credit', exact: true })).toBeVisible();
}
