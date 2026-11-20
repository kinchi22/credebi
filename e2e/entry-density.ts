import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';
import { directionArrow, expectBelow, expectLeftOf, expectOnOneRow, typeTile } from './account-type-cues';
import { addAccount, boxOf } from './accounts';
import {
  added,
  DAY,
  deleteButton,
  editButton,
  escaped,
  type Heading,
  type Line,
  type LineAccount,
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

export type Posted = Heading & { readonly lines: readonly Line[] };

export type Titled = Posted & { readonly title: string };

export type ShownLine = { readonly side: Side; readonly name: string; readonly amount: string };

export const line = (side: Side, account: LineAccount, amount: string): Line => ({ side, account, amount });

export const shownLines = (posted: Posted): readonly ShownLine[] =>
  posted.lines.map(({ side, account, amount }) => ({
    side,
    name: nameOf(account),
    amount: Number(amount).toLocaleString('en-US'),
  }));

function asTwoLine(posted: Posted): readonly TwoLineEntry[] {
  const [debit, credit, ...more] = posted.lines;
  if (debit === undefined || credit === undefined || more.length > 0) return [];
  return [{ ...posted, debitAccount: debit.account, creditAccount: credit.account, amount: debit.amount }];
}

export async function post(page: Page, posted: readonly Posted[]): Promise<void> {
  await postEntries(page, posted.flatMap(asTwoLine));
  for (const entry of posted.filter((each) => asTwoLine(each).length === 0)) {
    const form = await openEntryForm(page, 'Multi-line mode');
    await submitMultiLineEntry(form, entry);
    await expect(listedHeading(page, entry)).toHaveCount(1);
  }
}

const RAKUTEN_BANK = '\uB77C\uCFE0\uD150\uC740\uD589';

const NOMURA_SECURITIES = '\uB178\uBB34\uB77C\uC99D\uAD8C';

const PAYPAY_POINTS = '\uD398\uC774\uD398\uC774\uD3EC\uC778\uD2B8';

const GROCERIES = '\uC2DD\uB8CC\uD488';

export type LongKoreanNames = { readonly severalPerSide: Posted; readonly onePerSide: Posted };

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

export const entryTitle = (entry: Locator, heading: Heading): Locator =>
  firstShown(entry.getByText(heading.title ?? '', { exact: true }));

export const entryMemo = (entry: Locator, heading: Heading): Locator =>
  firstShown(entry.getByText(heading.memo, { exact: true }));

export const entryTotal = (entry: Locator): Locator => entry.getByTestId('entry-total');

const lookahead = (text: string): string => `(?=.*${escaped(text)})`;

export const chevronName = (heading: Heading): RegExp =>
  new RegExp(`^${lookahead(heading.day)}${lookahead(heading.title ?? heading.memo)}`, 'u');

export const chevron = (entry: Locator, heading: Heading): Locator =>
  entry.getByRole('button', { name: chevronName(heading) });

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
  for (const debit of debits) {
    for (const credit of credits) {
      const pair = `${debit.name} on Debit and ${credit.name} on Credit`;
      if (arrangement === 'stacked') {
        await expectBelow(lineOf(entry, debit), lineOf(entry, credit), pair);
      } else {
        await expectLeftOf(lineOf(entry, debit), lineOf(entry, credit), pair);
      }
    }
  }
  if (arrangement === 'stacked') {
    for (const debit of debits) {
      await expectBelow(lineOf(entry, debit), firstShown(sideName(entry, 'Credit')), `${debit.name} and the Credit name`);
    }
  } else {
    await expectOnOneRow(firstShown(sideName(entry, 'Debit')), firstShown(sideName(entry, 'Credit')), 'the Debit and Credit names');
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

export async function recordViewTransitions(page: Page): Promise<void> {
  await page.evaluate(`(() => {
    window.viewTransitionAnimations = 0;
    const look = () => {
      window.viewTransitionAnimations += document
        .getAnimations()
        .filter((animation) => String(animation.effect && animation.effect.pseudoElement).startsWith('::view-transition')).length;
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  })()`);
}

export const viewTransitionAnimations = async (page: Page): Promise<number> =>
  Number(await page.evaluate('window.viewTransitionAnimations'));

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
  for (let press = 0; press < 120 && !(await isFocused(target)); press += 1) {
    await page.keyboard.press('Tab');
    expect(await isFocused(entry), 'the Entry body is not a tab stop').toBe(false);
    const inside = entry.locator(':focus');
    if ((await inside.count()) > 0) {
      await expect(inside, 'only a button inside an Entry takes focus').toHaveRole('button');
    }
  }
  await expect(target).toBeFocused();
}
