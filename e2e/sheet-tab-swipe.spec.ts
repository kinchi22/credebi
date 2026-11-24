import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import { CATEGORIES, choosePeriod, fixToday, periodSheet } from './date-presets';
import {
  accountChoice,
  accountTick,
  addAccountButton,
  addLineOnPhone,
  chooseAccountButton,
  DAY,
  entryForm,
  findAnAccount,
  fillHeading,
  lineAmount,
  lineGroups,
  listedEntry,
  openAccountSheet,
  openEditEntry,
  openEntryForm,
  openMultiLineForm,
  openTwoLineAccountSheet,
  pressDone,
  sheetTab,
  SIDES,
  submit,
  submitMultiLineEntry,
  submitTwoLineEntry,
  titleField,
  twoLine,
} from './entries';
import { ENTRY_SEARCH_PATH } from './routes';
import { signIn } from './session';
import { MCP_CLIENTS, openConnectionDialog, startConnectingButton, type EntryFormMode } from './settings';
import {
  LEFT,
  recordSlides,
  RIGHT,
  slideAnimations,
  swipe,
  swipeThenClick,
  tap,
  type Swipe,
} from './swipe';
import { PHONE, WIDE, WIDE_BELOW_SPLIT, waitFrames } from './viewport';

const MODES: readonly EntryFormMode[] = ['Two-line mode', 'Multi-line mode'];

type Place = {
  readonly name: string;
  readonly tabs: readonly string[];
  readonly open: (page: Page) => Promise<Locator>;
  readonly find?: (root: Locator) => Locator;
};

const tabOf = (root: Locator, name: string): Locator =>
  root.getByRole('tablist').getByRole('tab', { name, exact: true });

const panelOf = (root: Locator): Locator => root.getByRole('tabpanel');

async function expectShowing(root: Locator, tabs: readonly string[], name: string): Promise<void> {
  for (const tab of tabs) {
    await expect(tabOf(root, tab)).toHaveAttribute('aria-selected', String(tab === name));
  }
  await expect(panelOf(root)).toHaveCount(1);
  await expect(panelOf(root)).toBeVisible();
  await expect(panelOf(root)).toHaveAccessibleName(name);
}

async function showFirst(place: Place, root: Locator): Promise<void> {
  const [first] = place.tabs;
  if (first === undefined) throw new Error('a place has tabs');
  await tabOf(root, first).click();
  await expectShowing(root, place.tabs, first);
}

const accountSheetOnPhone =
  (mode: EntryFormMode) =>
  async (page: Page): Promise<Locator> => {
    await page.setViewportSize(PHONE);
    await signIn(page);
    const form = await openEntryForm(page, mode);
    return mode === 'Two-line mode'
      ? openTwoLineAccountSheet(form, 'Debit')
      : openAccountSheet(form, 'Debit');
  };

async function postForEditing(page: Page, mode: EntryFormMode): Promise<string> {
  const memo = `Swipe edit ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const form = await openEntryForm(page, mode);
  if (mode === 'Two-line mode') {
    await submitTwoLineEntry(form, twoLine({ day: DAY, memo }));
  } else {
    await submitMultiLineEntry(form, {
      day: DAY,
      memo,
      lines: [
        { side: 'Debit', account: 'Food', amount: '12500' },
        { side: 'Credit', account: 'Cash', amount: '12500' },
      ],
    });
  }
  await expect(listedEntry(page, memo)).toHaveCount(1);
  return memo;
}

const editSheetOnPhone =
  (mode: EntryFormMode) =>
  async (page: Page): Promise<Locator> => {
    const memo = await postForEditing(page, mode);
    await page.setViewportSize(PHONE);
    const dialog = await openEditEntry(listedEntry(page, memo));
    return mode === 'Two-line mode'
      ? openTwoLineAccountSheet(dialog, 'Debit')
      : openAccountSheet(dialog, 'Debit');
  };

const pickerBelowSplit =
  (mode: EntryFormMode) =>
  async (page: Page): Promise<Locator> => {
    await signIn(page);
    const form = await openEntryForm(page, mode);
    await page.setViewportSize(WIDE_BELOW_SPLIT);
    await expect(sheetTab(form, 'Debit')).toBeVisible();
    return form;
  };

async function datePresetsOnPhone(page: Page): Promise<Locator> {
  await signIn(page);
  await page.setViewportSize(PHONE);
  await fixToday(page, DAY);
  await page.goto(ENTRY_SEARCH_PATH);
  await choosePeriod(page).click();
  const sheet = periodSheet(page);
  await expect(sheet).toBeVisible();
  return sheet;
}

async function connectionDialogOnPhone(page: Page): Promise<Locator> {
  await signIn(page);
  await page.setViewportSize(PHONE);
  await page.goto('/settings');
  return openConnectionDialog(startConnectingButton(page));
}

const CLIENT_TABS: readonly string[] = MCP_CLIENTS;

const PLACES: readonly Place[] = [
  ...MODES.flatMap((mode): readonly Place[] => [
    { name: `the Account sheet of the entry form at 390px in ${mode}`, tabs: SIDES, open: accountSheetOnPhone(mode), find: findAnAccount },
    { name: `the Account sheet of Edit entry at 390px in ${mode}`, tabs: SIDES, open: editSheetOnPhone(mode), find: findAnAccount },
    { name: `the Account picker at 1024px in ${mode}`, tabs: SIDES, open: pickerBelowSplit(mode), find: findAnAccount },
  ]),
  { name: 'the Date presets sheet at 390px', tabs: CATEGORIES, open: datePresetsOnPhone },
  { name: 'the Connection dialog at 390px', tabs: CLIENT_TABS, open: connectionDialogOnPhone },
];

for (const place of PLACES) {
  const { name, tabs } = place;

  test(`moves one tab per swipe in ${name}, left to the next and right to the previous, and never past either end`, async ({ page }) => {
    test.slow();
    const root = await place.open(page);
    await showFirst(place, root);
    const panel = panelOf(root);

    await swipe(panel, { dx: RIGHT });
    await expectShowing(root, tabs, tabs[0] ?? '');

    for (const next of tabs.slice(1)) {
      await swipe(panel, { dx: LEFT });
      await expectShowing(root, tabs, next);
    }
    await swipe(panel, { dx: LEFT });
    await expectShowing(root, tabs, tabs.at(-1) ?? '');

    for (const previous of tabs.slice(0, -1).reverse()) {
      await swipe(panel, { dx: RIGHT });
      await expectShowing(root, tabs, previous);
    }
    await swipe(panel, { dx: RIGHT });
    await expectShowing(root, tabs, tabs[0] ?? '');
  });

  test(`changes nothing in ${name} for a swipe that is short, mostly vertical, cancelled, started at a screen edge, on the tab strip, on a mouse or a pen`, async ({ page }) => {
    test.slow();
    const root = await place.open(page);
    await showFirst(place, root);
    const panel = panelOf(root);
    const width = (page.viewportSize() ?? PHONE).width;
    const ignored: readonly (readonly [string, Locator, Swipe])[] = [
      ['under 48px', panel, { dx: -47 }],
      ['under 1.5 times as far across as down', panel, { dx: LEFT, dy: 70 }],
      ['vertical', panel, { dx: 0, dy: 120 }],
      ['cancelled', panel, { dx: LEFT, cancel: true }],
      ['from the right edge', panel, { dx: LEFT, from: { x: width - 20, y: 300 } }],
      ['by mouse', panel, { dx: LEFT, pointer: 'mouse' }],
      ['by pen', panel, { dx: LEFT, pointer: 'pen' }],
      ['on the tab strip', root.getByRole('tablist'), { dx: LEFT }],
      ...(place.find === undefined
        ? []
        : ([['on Find an account', place.find(root), { dx: LEFT }]] as const)),
    ];

    for (const [what, target, gesture] of ignored) {
      await test.step(`a swipe ${what}`, async () => {
        await swipe(target, gesture);
        await waitFrames(page, 10);
        await expectShowing(root, tabs, tabs[0] ?? '');
      });
    }

    await swipe(panel, { dx: LEFT });
    await expectShowing(root, tabs, tabs[1] ?? '');
  });

  test(`switches tabs in ${name} on a tap, and on the arrow keys, the selected tab and the visible tabpanel agreeing`, async ({ page }) => {
    test.slow();
    const root = await place.open(page);
    await showFirst(place, root);
    const second = tabs[1] ?? '';

    await tabOf(root, second).click();
    await expectShowing(root, tabs, second);

    await tabOf(root, second).press('ArrowLeft');
    await expectShowing(root, tabs, tabs[0] ?? '');
    await tabOf(root, tabs[0] ?? '').press('ArrowRight');
    await expectShowing(root, tabs, second);
  });

  test(`slides the incoming panel when ${name} switches tab, by tap and by swipe`, async ({ page }) => {
    test.slow();
    const root = await place.open(page);
    await showFirst(place, root);
    await waitFrames(page, 40);
    await recordSlides(page);

    await tabOf(root, tabs[1] ?? '').click();
    await expectShowing(root, tabs, tabs[1] ?? '');
    await expect.poll(() => slideAnimations(page), { timeout: 2000 }).toBeGreaterThan(0);

    await waitFrames(page, 60);
    const before = await slideAnimations(page);
    await swipe(panelOf(root), { dx: RIGHT });
    await expectShowing(root, tabs, tabs[0] ?? '');
    await expect.poll(() => slideAnimations(page), { timeout: 2000 }).toBeGreaterThan(before);
  });

  test(`switches tab in ${name} with no slide when the User prefers reduced motion, by tap and by swipe`, async ({ page }) => {
    test.slow();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = await place.open(page);
    await showFirst(place, root);
    await waitFrames(page, 40);
    await recordSlides(page);

    await tabOf(root, tabs[1] ?? '').click();
    await expectShowing(root, tabs, tabs[1] ?? '');
    await swipe(panelOf(root), { dx: RIGHT });
    await expectShowing(root, tabs, tabs[0] ?? '');
    await swipe(panelOf(root), { dx: LEFT });
    await expectShowing(root, tabs, tabs[1] ?? '');

    await waitFrames(page, 40);
    expect(await slideAnimations(page)).toBe(0);
  });
}

for (const mode of MODES) {
  test(`keeps switching on every boundary of a swipe in the Account sheet at 390px in ${mode}: from 48px across, from 1.5 times as far across as down, and from just inside the screen edge`, async ({ page }) => {
    const root = await accountSheetOnPhone(mode)(page);
    const panel = panelOf(root);
    const gestures: readonly Swipe[] = [
      { dx: -48 },
      { dx: -72, dy: 48 },
      { dx: LEFT, from: { x: PHONE.width - 25, y: 300 } },
    ];

    for (const gesture of gestures) {
      await tabOf(root, 'Debit').click();
      await expectShowing(root, SIDES, 'Debit');
      await swipe(panel, gesture);
      await expectShowing(root, SIDES, 'Credit');
    }
  });

  test(`lets a swipe that starts on an Account at 390px in ${mode} switch tabs without choosing it, and a tap still choose it`, async ({ page }) => {
    const root = await accountSheetOnPhone(mode)(page);
    const chip =
      mode === 'Two-line mode'
        ? accountChoice(root, 'Debit', 'Food')
        : accountTick(root, 'Debit', 'Food');
    const panel = panelOf(root);

    await swipeThenClick(chip, { dx: LEFT }, panel);
    await expectShowing(root, SIDES, 'Credit');
    await tabOf(root, 'Debit').click();
    await expect(chip).not.toBeChecked();

    await tap(chip, panel);
    await expect(chip).toBeChecked();
  });
}

test('keeps the day, Title, memo, amounts, Entry lines and a validation message through swipes in the Account sheet at 390px in Multi-line mode, without submitting or closing the sheet', async ({ page }) => {
  test.slow();
  const memo = `Swipe keeps ${randomUUID()}`;
  const form = await openMultiLineForm(page);
  await page.setViewportSize(PHONE);
  await fillHeading(form, { day: DAY, title: 'Groceries', memo });
  await addLineOnPhone(form, { side: 'Debit', account: 'Food', amount: '12500' });
  await addLineOnPhone(form, { side: 'Credit', account: 'Cash', amount: '12000' });
  await submit(form);
  await expect(form.getByRole('alert')).toContainText(/balance/i);

  const sheet = await openAccountSheet(form, 'Credit');
  await swipe(panelOf(sheet), { dx: RIGHT });
  await expectShowing(sheet, SIDES, 'Debit');
  await swipe(panelOf(sheet), { dx: LEFT });
  await expectShowing(sheet, SIDES, 'Credit');
  await expect(sheet).toBeVisible();
  await pressDone(sheet);

  await expect(form.getByLabel('Date')).toHaveValue(DAY);
  await expect(titleField(form)).toHaveValue('Groceries');
  await expect(form.getByLabel('Memo')).toHaveValue(memo);
  await expect(lineAmount(form, 'Debit', 'Food')).toHaveValue(/12,?500/);
  await expect(lineAmount(form, 'Credit', 'Cash')).toHaveValue(/12,?000/);
  await expect(lineGroups(form)).toHaveCount(2);
  await expect(form.getByRole('alert')).toContainText(/balance/i);
  await expect(listedEntry(page, memo)).toHaveCount(0);
});

test('keeps the day, Title, memo, amount and chosen Account through swipes in the Account sheet at 390px in Two-line mode, without submitting or closing the sheet', async ({ page }) => {
  const memo = `Swipe keeps ${randomUUID()}`;
  await page.setViewportSize(PHONE);
  await signIn(page);
  const form = await openEntryForm(page, 'Two-line mode');
  await fillHeading(form, { day: DAY, title: 'Groceries', memo });
  await form.getByLabel('Amount').fill('12500');
  const sheet = await openTwoLineAccountSheet(form, 'Debit');
  await accountChoice(sheet, 'Debit', 'Food').check();
  await expectShowing(sheet, SIDES, 'Credit');

  await swipe(panelOf(sheet), { dx: RIGHT });
  await expectShowing(sheet, SIDES, 'Debit');
  await expect(accountChoice(sheet, 'Debit', 'Food')).toBeChecked();
  await swipe(panelOf(sheet), { dx: LEFT });
  await expectShowing(sheet, SIDES, 'Credit');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(sheet).toBeHidden();

  await expect(chooseAccountButton(form, 'Debit')).toContainText('Food');
  await expect(form.getByLabel('Date')).toHaveValue(DAY);
  await expect(titleField(form)).toHaveValue('Groceries');
  await expect(form.getByLabel('Memo')).toHaveValue(memo);
  await expect(form.getByLabel('Amount')).toHaveValue(/12,?500/);
  await expect(entryForm(page)).toBeVisible();
  await expect(listedEntry(page, memo)).toHaveCount(0);
});

test('keeps the own tab switches of the form at 390px in Two-line mode: choosing an Account on one Side while the other has none, and a submit finding a Side without one', async ({ page }) => {
  const memo = `Swipe own switch ${randomUUID()}`;
  await page.setViewportSize(PHONE);
  await signIn(page);
  const form = await openEntryForm(page, 'Two-line mode');
  await fillHeading(form, { day: DAY, memo });
  await form.getByLabel('Amount').fill('12500');

  const chosen = await openTwoLineAccountSheet(form, 'Debit');
  await expectShowing(chosen, SIDES, 'Debit');
  await accountChoice(chosen, 'Debit', 'Food').check();
  await expectShowing(chosen, SIDES, 'Credit');
  await chosen.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(chosen).toBeHidden();

  await submit(form);
  const sheet = page.getByRole('dialog', { name: 'Choose accounts', exact: true });
  await expect(sheet).toBeVisible();
  await expectShowing(sheet, SIDES, 'Credit');
});

test('shows the Credit tab by a swipe at 1024px in the Account picker beside the form, and the Debit tab again, keeping the Account chosen', async ({ page }) => {
  await signIn(page);
  const form = await openEntryForm(page, 'Two-line mode');
  await page.setViewportSize(WIDE_BELOW_SPLIT);
  await expect(sheetTab(form, 'Debit')).toBeVisible();

  await accountChoice(form, 'Debit', 'Food').check();
  await expectShowing(form, SIDES, 'Credit');
  await swipe(panelOf(form), { dx: RIGHT });
  await expectShowing(form, SIDES, 'Debit');
  await expect(accountChoice(form, 'Debit', 'Food')).toBeChecked();
});

for (const mode of MODES) {
  test(`ignores a swipe on either Side of the Account picker at 1280px in ${mode}, where both Sides show side by side, and slides nothing`, async ({ page }) => {
    await signIn(page);
    await page.setViewportSize(WIDE);
    const form = await openEntryForm(page, mode);
    const panels = form.getByRole('tabpanel');
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(panels).toHaveCount(2);
    await waitFrames(page, 40);
    await recordSlides(page);

    await swipe(panels.nth(0), { dx: LEFT });
    await swipe(panels.nth(1), { dx: RIGHT });
    await swipe(panels.nth(0), { dx: RIGHT });
    await swipe(panels.nth(1), { dx: LEFT });

    await waitFrames(page, 40);
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(panels.nth(0)).toBeVisible();
    await expect(panels.nth(1)).toBeVisible();
    expect(await slideAnimations(page)).toBe(0);
    await expect(addAccountButton(form, 'Debit')).toBeHidden();
  });
}
