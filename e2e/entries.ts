import { expect, type Locator, type Page } from '@playwright/test';
import { setEntryFormMode } from './settings';

export const AMOUNT = '12500';

export const amountShown = (formatted: string): RegExp =>
  new RegExp(`(?<![\\d,.-])${formatted}(?![\\d,.])`);

export const TWELVE_THOUSAND_FIVE_HUNDRED = amountShown('12,500');

export const DAY = '2026-09-15';

export const ACCOUNTS = ['Cash', 'Accounts payable', 'Capital', 'Sales', 'Expenses'] as const;

export type Account = (typeof ACCOUNTS)[number];

export type AddedAccount = { readonly added: string };

export type LineAccount = Account | AddedAccount;

export const nameOf = (account: LineAccount): string =>
  typeof account === 'string' ? account : account.added;

export const SIDES = ['Debit', 'Credit'] as const;

export type Side = (typeof SIDES)[number];

export type Heading = {
  readonly day: string;
  readonly title?: string;
  readonly memo: string;
};

export type TwoLineEntry = Heading & {
  readonly debitAccount: Account;
  readonly creditAccount: Account;
  readonly amount: string;
};

export type Line = {
  readonly side: Side;
  readonly account: LineAccount;
  readonly amount: string;
};

export type MultiLineEntry = Heading & {
  readonly lines: readonly Line[];
};

export const TITLE_MAX = 40;

export const MEMO_MAX = 200;

export const twoLine = (heading: Heading, creditAccount: Account = 'Cash'): TwoLineEntry => ({
  ...heading,
  debitAccount: 'Expenses',
  creditAccount,
  amount: AMOUNT,
});

export const titled = (
  title: string,
  memo: string,
  day = DAY,
  creditAccount: Account = 'Cash',
): TwoLineEntry => twoLine({ day, title, memo }, creditAccount);

export const entries = (page: Page): Locator => page.getByRole('region', { name: 'Entries' });

export const entryForm = (page: Page): Locator => page.getByRole('form', { name: 'New entry' });

export const entrySearchForm = (page: Page): Locator =>
  page.getByRole('form', { name: 'Search entries' });

export const accountChoices = (form: Page | Locator, side: Side): Locator =>
  form.getByRole('radiogroup', { name: `${side} account`, exact: true });

export const accountChoice = (form: Locator, side: Side, account: string): Locator =>
  accountChoices(form, side).getByRole('radio', { name: account, exact: true });

export const accountTicks = (form: Page | Locator, side: Side): Locator =>
  form.getByRole('group', { name: `${side} accounts`, exact: true });

export const accountTick = (form: Locator, side: Side, account: LineAccount): Locator =>
  accountTicks(form, side).getByRole('checkbox', { name: nameOf(account), exact: true });

const lineName = (side: Side, account: LineAccount): string => `${side} ${nameOf(account)}`;

export const lineGroup = (form: Locator, side: Side, account: LineAccount): Locator =>
  form.getByRole('group', { name: lineName(side, account), exact: true });

export const lineAmount = (form: Locator, side: Side, account: LineAccount): Locator =>
  lineGroup(form, side, account).getByLabel('Amount');

const escaped = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const lineGroups = (form: Locator, ...added: readonly AddedAccount[]): Locator =>
  form.getByRole('group', {
    name: new RegExp(
      `^(${SIDES.join('|')}) (${[...ACCOUNTS, ...added.map(nameOf)].map(escaped).join('|')})$`,
    ),
  });

const NOT_ACTIVE_ON_DAY = 'Not active on this day';

export const notActiveMark = (line: Locator): Locator =>
  line.getByText(NOT_ACTIVE_ON_DAY, { exact: true });

const notActiveRefusal = (side: Side, account: LineAccount): string =>
  `${lineName(side, account)} is not active on this day. Remove that line, or choose a day on which its account is active.`;

export const notActiveAlert = (form: Locator, side: Side, account: LineAccount): Locator =>
  form.getByRole('alert').filter({ hasText: notActiveRefusal(side, account) });

export const addAccountButton = (form: Locator, side: Side): Locator =>
  form.getByRole('button', { name: `Add ${side.toLowerCase()} account`, exact: true });

export const chooseAccountButton = (form: Locator, side: Side): Locator =>
  form.getByRole('button', { name: `Choose ${side.toLowerCase()} account`, exact: true });

export const NO_ACCOUNT_CHOSEN = 'Choose an account';

export const sheetTab = (sheet: Locator, side: Side): Locator =>
  sheet.getByRole('tablist').getByRole('tab', { name: side, exact: true });

export const findAnAccount = (sheet: Locator): Locator =>
  sheet.getByRole('searchbox', { name: 'Find an account', exact: true });

const accountSheet = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Choose accounts', exact: true });

async function openSheetWith(button: Locator): Promise<Locator> {
  await button.click();
  const sheet = accountSheet(button.page());
  await expect(sheet).toBeVisible();
  return sheet;
}

export async function openAccountSheet(form: Locator, side: Side): Promise<Locator> {
  return openSheetWith(addAccountButton(form, side));
}

export async function openTwoLineAccountSheet(form: Locator, side: Side): Promise<Locator> {
  return openSheetWith(chooseAccountButton(form, side));
}

export const doneButton = (sheet: Locator): Locator =>
  sheet.getByRole('button', { name: 'Done', exact: true });

export async function pressDone(sheet: Locator): Promise<void> {
  await doneButton(sheet).click();
  await expect(sheet).toBeHidden();
}

export const closeButton = (sheet: Locator): Locator =>
  sheet.getByRole('button', { name: 'Close', exact: true });

export async function expectSheetOnSide(sheet: Locator, side: Side): Promise<void> {
  for (const tab of SIDES) {
    await expect(sheetTab(sheet, tab)).toHaveAttribute('aria-selected', String(tab === side));
  }
}

export async function expectPickerOnSide(
  picker: Locator,
  side: Side,
  groups: (scope: Locator, side: Side) => Locator = accountChoices,
): Promise<void> {
  await expectSheetOnSide(picker, side);
  await expect(groups(picker, side)).toBeVisible();
  for (const hidden of SIDES.filter((other) => other !== side)) {
    await expect(groups(picker, hidden)).toBeHidden();
  }
}

export const editButton = (entry: Locator): Locator =>
  entry.getByRole('button', { name: 'Edit', exact: true });

export const editDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Edit entry', exact: true });

export async function openEditEntry(entry: Locator): Promise<Locator> {
  await editButton(entry).click();
  const dialog = editDialog(entry.page());
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function saveEdit(dialog: Locator): Promise<void> {
  await submit(dialog, 'Save');
  await expect(dialog).toBeHidden();
}

export const deleteButton = (entry: Locator): Locator =>
  entry.getByRole('button', { name: 'Delete', exact: true });

export const deleteDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Delete entry', exact: true });

export async function openDelete(entry: Locator): Promise<Locator> {
  await deleteButton(entry).click();
  const dialog = deleteDialog(entry.page());
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function deleteListed(entry: Locator): Promise<void> {
  const dialog = await openDelete(entry);
  await deleteButton(dialog).click();
  await expect(dialog).toBeHidden();
}

export const listedEntry = (page: Page, text: string): Locator =>
  page.getByTestId('entry').filter({ hasText: text });

export const titleField = (form: Locator): Locator =>
  form.getByRole('combobox', { name: 'Title', exact: true });

export const titleList = (page: Page): Locator => page.getByRole('listbox');

export const offeredTitles = (page: Page): Locator => titleList(page).getByRole('option');

export async function openTitleField(field: Locator): Promise<void> {
  await field.click();
  await field.fill('');
}

export async function expectOffered(page: Page, titles: readonly string[]): Promise<void> {
  await expect(offeredTitles(page)).toHaveText([...titles]);
}

export const offeredTitle = (page: Page, title: string): Locator =>
  titleList(page).getByRole('option', { name: title, exact: true });

const TITLE_TO_MEMO = '\\s*(?:[^\\p{L}\\p{N}\\s]\\s*)?';

const named = ({ title, memo }: Heading): string =>
  [title ?? '', memo]
    .filter((part) => part !== '')
    .map(escaped)
    .join(TITLE_TO_MEMO);

const AMOUNT_SHOWN = Number(AMOUNT).toLocaleString('en-US');

export const headingShowing = (heading: Heading, total = AMOUNT_SHOWN): RegExp =>
  new RegExp(
    `^\\s*${escaped(heading.day)}\\s*${named(heading)}\\s*(?:Total\\s*)?${escaped(total)}(?![\\d,.])`,
    'u',
  );

async function fillHeading(form: Locator, heading: Heading): Promise<void> {
  await form.getByLabel('Date').fill(heading.day);
  if (heading.title !== undefined) {
    await titleField(form).fill(heading.title);
  }
  await form.getByLabel('Memo').fill(heading.memo);
}

export async function submit(form: Locator, name: 'Add entry' | 'Save' = 'Add entry'): Promise<void> {
  await form.getByRole('button', { name, exact: true }).click();
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
  const sheet = await openTwoLineAccountSheet(form, 'Debit');
  await accountChoice(sheet, 'Debit', entry.debitAccount).check();
  await expectSheetOnSide(sheet, 'Credit');
  await accountChoice(sheet, 'Credit', entry.creditAccount).check();
  await expect(sheet).toBeHidden();
  await form.getByLabel('Amount').fill(entry.amount);
  await submit(form);
}

export async function addLineOnPhone(form: Locator, line: Line): Promise<void> {
  const sheet = await openAccountSheet(form, line.side);
  await accountTick(sheet, line.side, line.account).check();
  await pressDone(sheet);
  await lineAmount(form, line.side, line.account).fill(line.amount);
}

export async function addLine(form: Locator, line: Line): Promise<void> {
  await accountTick(form, line.side, line.account).check();
  await lineAmount(form, line.side, line.account).fill(line.amount);
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
