import { expect, type Locator } from '@playwright/test';
import { boxOf } from './accounts';
import {
  ACCOUNT_TYPES,
  type AccountType,
  BALANCE_DIRECTION,
  type Side,
} from './entries';
import { initialNames } from './initial-chart';
import { CATALOGUE, type Language } from './language';

export const TYPE_TINT: Readonly<Record<AccountType, string>> = {
  Assets: 'rgb(236, 229, 225)',
  Liabilities: 'rgb(231, 227, 245)',
  Equity: 'rgb(219, 233, 238)',
  Revenue: 'rgb(229, 236, 217)',
  Expenses: 'rgb(242, 224, 233)',
};

export const SUGGESTED_TINT = 'rgb(220, 240, 233)';

export function typeOf(account: string): AccountType {
  const type = ACCOUNT_TYPES.find((each) => initialNames(each).includes(account));
  if (type === undefined) {
    throw new Error(`${account} is not in the starting Chart of accounts`);
  }
  return type;
}

export const band = (scope: Locator): Locator => scope.getByTestId('band').filter({ visible: true });

export const typeTile = (scope: Locator): Locator =>
  scope.getByTestId('type-tile').filter({ visible: true });

export const directionArrow = (scope: Locator): Locator =>
  scope.getByTestId('balance-direction').filter({ visible: true });

export const typeAndDirection = (account: string, side: Side, shown: Language = 'en'): string => {
  const type = typeOf(account);
  const text = CATALOGUE[shown];
  return `${text.accounts.types[type]}, ${text.directions[BALANCE_DIRECTION[type][side]]}`;
};

export const entryLineName = (account: string, side: Side, shown: Language = 'en'): string =>
  `${account}, ${typeAndDirection(account, side, shown)}`;

export const formLineName = (account: string, side: Side): string =>
  `${side} ${account}, ${typeAndDirection(account, side)}`;

export async function expectTinted(shown: Locator, tint: string): Promise<void> {
  await expect(shown).toHaveCount(1);
  await expect(shown).toBeVisible();
  await expect(shown).toHaveCSS('background-color', tint);
}

export async function expectTile(scope: Locator, type: AccountType): Promise<void> {
  const tiles = typeTile(scope);
  await expect(tiles.first()).toBeVisible();
  for (const tile of await tiles.all()) {
    await expect(tile).toHaveCSS('background-color', TYPE_TINT[type]);
  }
}

export async function expectLeftOf(first: Locator, then: Locator, what: string): Promise<void> {
  await expect(first).toBeVisible();
  await expect(then).toBeVisible();
  const left = await boxOf(first, `the ${what} that comes first`);
  const right = await boxOf(then, `the ${what} that follows`);
  expect(left.x + left.width, `${what}: the first ends before the second starts`).toBeLessThanOrEqual(right.x);
}

export async function expectOnOneRow(first: Locator, then: Locator, what: string): Promise<void> {
  await expectLeftOf(first, then, what);
  const left = await boxOf(first, `the ${what} that comes first`);
  const right = await boxOf(then, `the ${what} that follows`);
  const centre = right.y + right.height / 2;
  expect(centre, `${what}: on one row`).toBeGreaterThanOrEqual(left.y);
  expect(centre, `${what}: on one row`).toBeLessThanOrEqual(left.y + left.height);
}

export async function expectNameCued(scope: Locator, account: string): Promise<void> {
  await expectTile(scope, typeOf(account));
  const name = scope.getByText(account, { exact: true }).filter({ visible: true }).first();
  await expectLeftOf(typeTile(scope).first(), name, `${account}'s tile and name`);
  await expectLeftOf(name, directionArrow(scope).first(), `${account}'s name and Balance direction arrow`);
}

type Styled = {
  readonly ownerDocument: {
    readonly defaultView: {
      getComputedStyle: (element: Styled) => { readonly backgroundColor: string; readonly paddingLeft: string };
    } | null;
  };
  readonly querySelectorAll: (selectors: string) => ArrayLike<Styled>;
};

export async function expectNothingTinted(scope: Locator): Promise<void> {
  const tinted = await scope.evaluate(
    (root: Styled, tints: readonly string[]) =>
      [root, ...Array.from(root.querySelectorAll('*'))].filter((each) =>
        tints.includes(each.ownerDocument.defaultView?.getComputedStyle(each).backgroundColor ?? ''),
      ).length,
    Object.values(TYPE_TINT),
  );
  expect(tinted, 'elements filled with an Account type tint').toBe(0);
}

export async function expectLeadsTypedText(tile: Locator, field: Locator, what: string): Promise<void> {
  await expect(tile).toBeVisible();
  await expect(field).toBeVisible();
  const box = await boxOf(field, `the ${what} field`);
  const padding = Number.parseFloat(
    await field.evaluate((each: Styled) => each.ownerDocument.defaultView?.getComputedStyle(each).paddingLeft ?? ''),
  );
  const shown = await boxOf(tile, `the ${what} tile`);
  expect(shown.x + shown.width, `${what}: the tile ends before the typed text starts`).toBeLessThanOrEqual(
    box.x + padding,
  );
}
