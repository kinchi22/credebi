import { expect, type Locator, type Page } from '@playwright/test';
import { directionArrow, expectLeftOf, expectOnOneRow, typeTile } from './account-type-cues';
import { boxOf } from './accounts';
import { deleteButton, editButton, escaped, type Heading, type Side, SIDES } from './entries';

export const NARROW_WIDE = { width: 800, height: 900 } as const;

export type ShownLine = { readonly side: Side; readonly name: string; readonly amount: string };

export const lineOf = (entry: Locator, line: ShownLine): Locator =>
  entry
    .getByTestId('entry-line')
    .filter({ visible: true })
    .filter({ has: entry.page().getByText(line.name, { exact: true }) });

export const nameIn = (entry: Locator, line: ShownLine): Locator =>
  lineOf(entry, line).getByText(line.name, { exact: true });

const amountIn = (entry: Locator, line: ShownLine): Locator =>
  lineOf(entry, line).getByText(line.amount, { exact: true });

const sideName = (entry: Locator, side: Side): Locator => entry.getByText(side, { exact: true });

const shown = (scope: Locator): Locator => scope.filter({ visible: true }).first();

export const entryDate = (entry: Locator, heading: Heading): Locator =>
  shown(entry.getByText(heading.day, { exact: true }));

export const entryTitle = (entry: Locator, heading: Heading): Locator =>
  shown(entry.getByText(heading.title ?? '', { exact: true }));

export const entryMemo = (entry: Locator, heading: Heading): Locator =>
  shown(entry.getByText(heading.memo, { exact: true }));

export const entryTotal = (entry: Locator): Locator => entry.getByTestId('entry-total');

const lookahead = (text: string): string => `(?=.*${escaped(text)})`;

export const chevron = (entry: Locator, heading: Heading): Locator =>
  entry.getByRole('button', {
    name: new RegExp(`^${lookahead(heading.day)}${lookahead(heading.title ?? heading.memo)}`, 'u'),
  });

export async function expectNoChevron(entry: Locator): Promise<void> {
  await expect(entry).toHaveCount(1);
  await expect(editButton(entry)).toBeVisible();
  await expect(deleteButton(entry)).toBeVisible();
  await expect(entry.getByRole('button'), 'an Entry with no chevron has only Edit and Delete').toHaveCount(2);
}

export async function expectExpanded(entry: Locator, heading: Heading, expanded: boolean): Promise<void> {
  await expect(chevron(entry, heading)).toHaveAttribute('aria-expanded', String(expanded));
}

export async function expectVisuallyHidden(locator: Locator, what: string): Promise<void> {
  await expect(locator.first(), `${what} is still in the page`).toBeAttached();
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

export async function expectBelow(above: Locator, below: Locator, what: string): Promise<void> {
  const upper = await boxOf(above, `${what}: the upper one`);
  const lower = await boxOf(below, `${what}: the lower one`);
  expect(lower.y, `${what}: one below the other`).toBeGreaterThanOrEqual(upper.y + upper.height - 1);
}

type Styled = {
  readonly ownerDocument: {
    readonly defaultView: { getComputedStyle: (element: Styled) => { readonly lineHeight: string } } | null;
  };
};

export async function expectOnOneLine(name: Locator, what: string): Promise<void> {
  const box = await boxOf(name, what);
  const lineHeight = Number.parseFloat(
    await name.evaluate((element: Styled) => element.ownerDocument.defaultView?.getComputedStyle(element).lineHeight ?? ''),
  );
  expect(box.height, `${what} fits on one line`).toBeLessThan(lineHeight * 1.5);
}

async function expectCuedLine(entry: Locator, line: ShownLine): Promise<void> {
  const shownLine = lineOf(entry, line);
  await expect(shownLine, `${line.name} on ${line.side} is listed once`).toHaveCount(1);
  const name = nameIn(entry, line);
  await expectShown(typeTile(shownLine).first(), `${line.name}'s tile`);
  await expectShown(name, `${line.name}'s name`);
  await expectShown(directionArrow(shownLine).first(), `${line.name}'s Balance direction arrow`);
  await expectLeftOf(typeTile(shownLine).first(), name, `${line.name}'s tile and name`);
  await expectLeftOf(name, directionArrow(shownLine).first(), `${line.name}'s name and arrow`);
}

const onSide = (lines: readonly ShownLine[], side: Side): readonly ShownLine[] =>
  lines.filter((line) => line.side === side);

function firstOn(lines: readonly ShownLine[], side: Side): ShownLine {
  const [first] = onSide(lines, side);
  if (first === undefined) throw new Error(`an Entry has a line on ${side}`);
  return first;
}

export async function expectCompact(entry: Locator, lines: readonly ShownLine[]): Promise<void> {
  await expect(entry).toHaveCount(1);
  for (const line of lines) {
    await expectCuedLine(entry, line);
    await expectVisuallyHidden(amountIn(entry, line), `${line.name}'s amount in the compact line`);
    expect(
      await lineOf(entry, line).ariaSnapshot(),
      `${line.name}'s amount is still told to assistive technology`,
    ).toContain(line.amount);
  }
  for (const side of SIDES) {
    await expectVisuallyHidden(sideName(entry, side), `the ${side} name in the compact Entry`);
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
    await expectShown(shown(sideName(entry, side)), `the ${side} name`);
  }
  for (const line of lines) {
    await expectCuedLine(entry, line);
    const amount = amountIn(entry, line);
    await expectShown(amount, `${line.name}'s amount`);
    await expectOnOneRow(nameIn(entry, line), amount, `${line.name}'s name and amount`);
    await expectBelow(shown(sideName(entry, line.side)), lineOf(entry, line), `the ${line.side} name and ${line.name}`);
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
      await expectBelow(lineOf(entry, debit), shown(sideName(entry, 'Credit')), `${debit.name} and the Credit name`);
    }
  } else {
    await expectOnOneRow(shown(sideName(entry, 'Debit')), shown(sideName(entry, 'Credit')), 'the Debit and Credit names');
  }
}

export async function expectThreeRowHeader(entry: Locator, heading: Heading & { readonly title: string }): Promise<void> {
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

export async function expectOneRowHeader(entry: Locator, heading: Heading & { readonly title: string }): Promise<void> {
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

export async function waitFrames(page: Page, frames: number): Promise<void> {
  await page.evaluate(`new Promise((resolve) => {
    let left = ${String(frames)};
    const next = () => (--left > 0 ? requestAnimationFrame(next) : resolve(undefined));
    requestAnimationFrame(next);
  })`);
}

export async function selectText(page: Page, text: Locator): Promise<void> {
  const box = await boxOf(text, 'the text to select');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, y, { steps: 8 });
  await page.mouse.up();
  expect(String(await page.evaluate('String(window.getSelection())')).length, 'some text is selected').toBeGreaterThan(0);
}
