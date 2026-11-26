import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';
import { directionArrow, expectBelow, expectLeftOf, expectOnOneRow, typeTile } from './account-type-cues';
import { addAccount, boxOf } from './accounts';
import { recordAnimations, VIEW_TRANSITION_ANIMATION } from './animations';
import {
  added,
  DAY,
  deleteButton,
  editButton,
  escaped,
  type Heading,
  type Line,
  type LineAccount,
  type MultiLineEntry,
  listedHeading,
  nameOf,
  openEntryForm,
  postEntries,
  type Side,
  SIDES,
  submitMultiLineEntry,
  type TwoLineEntry,
} from './entries';
import { SETTINGS_PATH } from './routes';
import { BOOKS_OPEN, signIn } from './session';

export type Titled = MultiLineEntry & { readonly title: string };

export type ShownLine = { readonly side: Side; readonly name: string; readonly amount: string };

export const line = (side: Side, account: LineAccount, amount: string): Line => ({ side, account, amount });

export const shownLines = (posted: MultiLineEntry): readonly ShownLine[] =>
  posted.lines.map(({ side, account, amount }) => ({
    side,
    name: nameOf(account),
    amount: Number(amount).toLocaleString('en-US'),
  }));

const hasTwoLines = (entry: MultiLineEntry): boolean => entry.lines.length === 2;

function asTwoLine(entry: MultiLineEntry): TwoLineEntry {
  const [debit, credit] = entry.lines;
  if (debit === undefined || credit === undefined) throw new Error('a Two-line mode Entry has two lines');
  return { ...entry, debitAccount: debit.account, creditAccount: credit.account, amount: debit.amount };
}

export async function post(page: Page, posted: readonly MultiLineEntry[]): Promise<void> {
  await postEntries(page, posted.filter(hasTwoLines).map(asTwoLine));
  for (const entry of posted.filter((each) => !hasTwoLines(each))) {
    const form = await openEntryForm(page, 'Multi-line mode');
    await submitMultiLineEntry(form, entry);
    await expect(listedHeading(page, entry)).toHaveCount(1);
  }
}

const RAKUTEN_BANK = '\uB77C\uCFE0\uD150\uC740\uD589';

const NOMURA_SECURITIES = '\uB178\uBB34\uB77C\uC99D\uAD8C';

const PAYPAY_POINTS = '\uD398\uC774\uD398\uC774\uD3EC\uC778\uD2B8';

const GROCERIES = '\uC2DD\uB8CC\uD488';

export type LongKoreanNames = { readonly severalPerSide: MultiLineEntry; readonly onePerSide: MultiLineEntry };

export async function postLongKoreanNames(page: Page): Promise<LongKoreanNames> {
  const run = randomUUID();
  const posted: LongKoreanNames = {
    severalPerSide: {
      day: DAY,
      memo: `Several ${run}`,
      lines: [
        line('Debit', added(RAKUTEN_BANK), '12345678'),
        line('Debit', added(NOMURA_SECURITIES), '150000'),
        line('Credit', added(PAYPAY_POINTS), '150000'),
        line('Credit', 'Salary', '12345678'),
      ],
    },
    onePerSide: {
      day: DAY,
      memo: `One ${run}`,
      lines: [line('Debit', added(GROCERIES), '3580'), line('Credit', added(RAKUTEN_BANK), '3580')],
    },
  };
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await page.goto(SETTINGS_PATH);
  for (const name of [RAKUTEN_BANK, NOMURA_SECURITIES, PAYPAY_POINTS]) {
    await addAccount(page, 'Assets', { name, activeFrom: BOOKS_OPEN });
  }
  await addAccount(page, 'Expenses', { name: GROCERIES, activeFrom: BOOKS_OPEN });
  await post(page, [posted.onePerSide, posted.severalPerSide]);
  return posted;
}

export const lineOf = (entry: Locator, shown: ShownLine): Locator =>
  entry
    .getByTestId('entry-line')
    .filter({ visible: true })
    .filter({ has: entry.page().getByText(shown.name, { exact: true }) });

export const nameIn = (entry: Locator, shown: ShownLine): Locator =>
  lineOf(entry, shown).getByText(shown.name, { exact: true });

const amountIn = (entry: Locator, shown: ShownLine): Locator =>
  lineOf(entry, shown).getByText(shown.amount, { exact: true });

const sideName = (entry: Locator, side: Side): Locator => entry.getByText(side, { exact: true });

const firstShown = (scope: Locator): Locator => scope.filter({ visible: true }).first();

export const entryDate = (entry: Locator, heading: Heading): Locator =>
  firstShown(entry.getByText(heading.day, { exact: true }));

export const entryTitle = (entry: Locator, heading: Titled): Locator =>
  firstShown(entry.getByText(heading.title, { exact: true }));

export const entryMemo = (entry: Locator, heading: Heading): Locator =>
  firstShown(entry.getByText(heading.memo, { exact: true }));

export const entryTotal = (entry: Locator): Locator => entry.getByTestId('entry-total');

const lookahead = (text: string): string => `(?=.*${escaped(text)})`;

export const chevronName = (heading: Heading): RegExp =>
  new RegExp(`^${lookahead(heading.day)}${lookahead(heading.title ?? heading.memo)}`, 'u');

export const chevron = (entry: Locator, heading: Heading): Locator =>
  entry.getByRole('button', { name: chevronName(heading) });

const NAMED = /^- button "(?<name>(?:[^"\\]|\\.)*)"/u;

export async function expectChevronNamesAnAction(entry: Locator, heading: Heading): Promise<void> {
  const button = chevron(entry, heading);
  await expect(button).toBeVisible();
  const name = NAMED.exec(await button.ariaSnapshot())?.groups?.['name'] ?? '';
  const beyondEntry = name.replace(heading.day, '').replace(heading.title ?? heading.memo, '');
  expect(beyondEntry, `the chevron "${name}" names an action besides the Entry`).toMatch(/\p{L}/u);
}

export async function expectNoChevron(entry: Locator): Promise<void> {
  await expect(entry).toHaveCount(1);
  await expect(editButton(entry)).toBeVisible();
  await expect(deleteButton(entry)).toBeVisible();
  await expect(entry.getByRole('button'), 'an Entry with no chevron has only Edit and Delete').toHaveCount(2);
}

export async function expectExpanded(entry: Locator, heading: Heading, expanded: boolean): Promise<void> {
  await expect(chevron(entry, heading)).toHaveAttribute('aria-expanded', String(expanded));
}

async function expectNotShown(locator: Locator, what: string): Promise<void> {
  for (const each of await locator.all()) {
    const box = await each.boundingBox();
    expect(box === null || box.width <= 1 || box.height <= 1, `${what} is not shown`).toBe(true);
  }
}

async function expectShown(locator: Locator, what: string): Promise<void> {
  await expect(locator, what).toBeVisible();
  const box = await boxOf(locator, what);
  expect(box.width, `${what} is shown wider than a pixel`).toBeGreaterThan(1);
  expect(box.height, `${what} is shown taller than a pixel`).toBeGreaterThan(1);
}

async function expectCuedLine(entry: Locator, shown: ShownLine): Promise<void> {
  const shownLine = lineOf(entry, shown);
  await expect(shownLine, `${shown.name} on ${shown.side} is listed once`).toHaveCount(1);
  const name = nameIn(entry, shown);
  await expectShown(typeTile(shownLine).first(), `${shown.name}'s tile`);
  await expectShown(name, `${shown.name}'s name`);
  await expectShown(directionArrow(shownLine).first(), `${shown.name}'s Balance direction arrow`);
  await expectLeftOf(typeTile(shownLine).first(), name, `${shown.name}'s tile and name`);
  await expectLeftOf(name, directionArrow(shownLine).first(), `${shown.name}'s name and arrow`);
}

const onSide = (lines: readonly ShownLine[], side: Side): readonly ShownLine[] =>
  lines.filter((each) => each.side === side);

export function firstOn(lines: readonly ShownLine[], side: Side): ShownLine {
  const [first] = onSide(lines, side);
  if (first === undefined) throw new Error(`an Entry has a line on ${side}`);
  return first;
}

export async function expectCompact(entry: Locator, lines: readonly ShownLine[]): Promise<void> {
  await expect(entry).toHaveCount(1);
  for (const shown of lines) {
    await expectCuedLine(entry, shown);
    await expectNotShown(amountIn(entry, shown), `${shown.name}'s amount in the compact line`);
    expect(
      await lineOf(entry, shown).ariaSnapshot(),
      `${shown.name}'s amount is still told to assistive technology`,
    ).toContain(shown.amount);
  }
  for (const side of SIDES) {
    await expectNotShown(sideName(entry, side), `the ${side} name in the compact Entry`);
  }
  for (const debit of onSide(lines, 'Debit')) {
    for (const credit of onSide(lines, 'Credit')) {
      await expectLeftOf(lineOf(entry, debit), lineOf(entry, credit), `${debit.name} on Debit and ${credit.name} on Credit`);
    }
  }
  await expectOnOneRow(
    nameIn(entry, firstOn(lines, 'Debit')),
    nameIn(entry, firstOn(lines, 'Credit')),
    'the first line of each Side',
  );
}

export type Arrangement = 'stacked' | 'side by side';

export async function expectDetailed(
  entry: Locator,
  lines: readonly ShownLine[],
  arrangement: Arrangement,
): Promise<void> {
  await expect(entry).toHaveCount(1);
  for (const side of SIDES) {
    await expectShown(firstShown(sideName(entry, side)), `the ${side} name`);
  }
  for (const shown of lines) {
    await expectCuedLine(entry, shown);
    const amount = amountIn(entry, shown);
    await expectShown(amount, `${shown.name}'s amount`);
    await expectOnOneRow(nameIn(entry, shown), amount, `${shown.name}'s name and amount`);
    await expectBelow(firstShown(sideName(entry, shown.side)), lineOf(entry, shown), `the ${shown.side} name and ${shown.name}`);
  }
  const debits = onSide(lines, 'Debit');
  const credits = onSide(lines, 'Credit');
  if (arrangement === 'stacked') {
    for (const debit of debits) {
      await expectBelow(lineOf(entry, debit), firstShown(sideName(entry, 'Credit')), `${debit.name} and the Credit name`);
      for (const credit of credits) {
        await expectBelow(lineOf(entry, debit), lineOf(entry, credit), `${debit.name} on Debit and ${credit.name} on Credit`);
      }
    }
    return;
  }
  await expectOnOneRow(firstShown(sideName(entry, 'Debit')), firstShown(sideName(entry, 'Credit')), 'the Debit and Credit names');
  for (const debit of debits) {
    for (const credit of credits) {
      await expectLeftOf(lineOf(entry, debit), lineOf(entry, credit), `${debit.name} on Debit and ${credit.name} on Credit`);
    }
  }
}

export async function expectThreeRowHeader(entry: Locator, heading: Titled): Promise<void> {
  const date = entryDate(entry, heading);
  const title = entryTitle(entry, heading);
  const memo = entryMemo(entry, heading);
  const total = entryTotal(entry);
  await expectOnOneRow(date, editButton(entry), 'the date and Edit');
  await expectLeftOf(editButton(entry), deleteButton(entry), 'Edit and Delete');
  await expectBelow(date, title, 'the date and the Title');
  await expectBelow(editButton(entry), total, 'Edit and the Entry total');
  await expectOnOneRow(title, total, 'the Title and the Entry total');
  await expectBelow(title, memo, 'the Title and the memo');
  await expectBelow(total, memo, 'the Entry total and the memo');
  const dateBox = await boxOf(date, 'the date');
  const memoBox = await boxOf(memo, 'the memo');
  const totalBox = await boxOf(total, 'the Entry total');
  expect(Math.abs(memoBox.x - dateBox.x), 'the memo starts where the date does').toBeLessThanOrEqual(1);
  expect(memoBox.x + memoBox.width, 'the memo runs on under the Entry total').toBeGreaterThan(totalBox.x);
}

export async function expectTotalAloneOnItsRow(entry: Locator, heading: Heading): Promise<void> {
  const total = entryTotal(entry);
  await expectBelow(entryDate(entry, heading), total, 'the date and the Entry total');
  await expectBelow(deleteButton(entry), total, 'Delete and the Entry total');
  await expectBelow(total, entryMemo(entry, heading), 'the Entry total and the memo');
  const totalBox = await boxOf(total, 'the Entry total');
  const deleteBox = await boxOf(deleteButton(entry), 'Delete');
  expect(totalBox.x + totalBox.width, 'the Entry total ends at the right, under Delete').toBeGreaterThan(deleteBox.x);
}

export async function expectOneRowHeader(entry: Locator, heading: Titled): Promise<void> {
  const date = entryDate(entry, heading);
  const total = entryTotal(entry);
  await expectOnOneRow(date, entryTitle(entry, heading), 'the date and the Title');
  await expectOnOneRow(date, total, 'the date and the Entry total');
  await expectOnOneRow(total, editButton(entry), 'the Entry total and Edit');
  await expectOnOneRow(editButton(entry), deleteButton(entry), 'Edit and Delete');
  await expectLeftOf(entryMemo(entry, heading), total, 'the memo and the Entry total');
  await expectLeftOf(entryTitle(entry, heading), total, 'the Title and the Entry total');
}

export const recordViewTransitions = (page: Page): Promise<void> =>
  recordAnimations(page, VIEW_TRANSITION_ANIMATION);

export async function selectText(page: Page, text: Locator): Promise<void> {
  const box = await boxOf(text, 'the text to select');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, y, { steps: 8 });
  await page.mouse.up();
  expect(String(await page.evaluate('String(window.getSelection())')).length, 'some text is selected').toBeGreaterThan(0);
}

type Focusable = { readonly ownerDocument: { readonly activeElement: unknown } };

const isFocused = async (locator: Locator): Promise<boolean> =>
  (await locator.count()) === 1 && locator.evaluate((each: Focusable) => each.ownerDocument.activeElement === each);

export async function tabToChevronPassingOver(page: Page, entry: Locator, target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  const stops = [editButton(entry), deleteButton(entry), target];
  for (let press = 0; press < 120 && !(await isFocused(target)); press += 1) {
    await page.keyboard.press('Tab');
    if ((await entry.locator(':focus').count()) > 0 || (await isFocused(entry))) {
      const focused = await Promise.all(stops.map(isFocused));
      expect(focused.includes(true), 'focus inside an Entry lands only on Edit, Delete or the chevron').toBe(true);
    }
  }
  await expect(target).toBeFocused();
}
