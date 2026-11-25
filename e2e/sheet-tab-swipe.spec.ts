import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import { CATEGORIES, choosePeriod, fixToday, periodSheet } from './date-presets';
import {
  accountChoice,
  accountSheet,
  accountTick,
  addLineOnPhone,
  chooseAccountButton,
  closeButton,
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
  postEntries,
  pressDone,
  sheetTab,
  SIDES,
  submit,
  submitMultiLineEntry,
  submitTwoLineEntry,
  submitTwoLineEntryOnPhone,
  TITLE_MAX,
  titleField,
  twoLine,
} from './entries';
import { SETTINGS_PATH, ENTRY_SEARCH_PATH } from './routes';
import { signIn } from './session';
import {
  clientGuidance as panelOf,
  clientTab,
  MCP_CLIENTS,
  openConnectionDialog,
  startConnectingButton,
  type EntryFormMode,
  type McpClientName,
} from './settings';
import { LEFT, recordSlides, RIGHT, slideAnimations, swipe, tap, type Swipe } from './swipe';
import { PHONE, WIDE, WIDE_BELOW_SPLIT, waitFrames } from './viewport';

const MODES: readonly EntryFormMode[] = ['Two-line mode', 'Multi-line mode'];

type Tabs = {
  readonly names: readonly string[];
  readonly tab: (root: Locator, name: string) => Locator;
};

type Place = Tabs & {
  readonly name: string;
  readonly open: (page: Page) => Promise<Locator>;
  readonly find?: (root: Locator) => Locator;
};

function named<Name extends string>(all: readonly Name[], name: string): Name {
  const found = all.find((each) => each === name);
  if (found === undefined) throw new Error(`${name} is not a tab here`);
  return found;
}

const SIDE_TABS: Tabs = { names: SIDES, tab: (root, name) => sheetTab(root, named(SIDES, name)) };

const PRESET_TABS: Tabs = {
  names: CATEGORIES,
  tab: (root, name) => root.getByRole('tablist').getByRole('tab', { name, exact: true }),
};

const CLIENT_TABS: Tabs = {
  names: MCP_CLIENTS,
  tab: (root, name) => clientTab(root, named<McpClientName>(MCP_CLIENTS, name)),
};

async function expectShowing(root: Locator, tabs: Tabs, name: string): Promise<void> {
  for (const each of tabs.names) {
    await expect(tabs.tab(root, each)).toHaveAttribute('aria-selected', String(each === name));
  }
  await expect(panelOf(root)).toHaveCount(1);
  await expect(panelOf(root)).toBeVisible();
  await expect(panelOf(root)).toHaveAccessibleName(name);
}

const firstOf = (tabs: Tabs): string => tabs.names[0] ?? '';

const secondOf = (tabs: Tabs): string => tabs.names[1] ?? '';

const lastOf = (tabs: Tabs): string => tabs.names.at(-1) ?? '';

async function showFirst(tabs: Tabs, root: Locator): Promise<void> {
  await tabs.tab(root, firstOf(tabs)).click();
  await expectShowing(root, tabs, firstOf(tabs));
}

const openSheetOn = (mode: EntryFormMode, scope: Locator): Promise<Locator> =>
  mode === 'Two-line mode' ? openTwoLineAccountSheet(scope, 'Debit') : openAccountSheet(scope, 'Debit');

const leaveSheet = (mode: EntryFormMode, sheet: Locator): Promise<void> =>
  mode === 'Two-line mode' ? closeButton(sheet).click() : pressDone(sheet);

const accountSheetOnPhone =
  (mode: EntryFormMode) =>
  async (page: Page): Promise<Locator> => {
    await page.setViewportSize(PHONE);
    await signIn(page);
    return openSheetOn(mode, await openEntryForm(page, mode));
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

async function editDialogOnPhone(page: Page, mode: EntryFormMode): Promise<Locator> {
  const memo = await postForEditing(page, mode);
  await page.setViewportSize(PHONE);
  return openEditEntry(listedEntry(page, memo));
}

const editSheetOnPhone =
  (mode: EntryFormMode) =>
  async (page: Page): Promise<Locator> =>
    openSheetOn(mode, await editDialogOnPhone(page, mode));

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
  await page.goto(SETTINGS_PATH);
  return openConnectionDialog(startConnectingButton(page));
}

const PLACES: readonly Place[] = [
  ...MODES.flatMap((mode): readonly Place[] => [
    { ...SIDE_TABS, name: `the Account sheet of the entry form at 390px in ${mode}`, open: accountSheetOnPhone(mode), find: findAnAccount },
    { ...SIDE_TABS, name: `the Account sheet of Edit entry at 390px in ${mode}`, open: editSheetOnPhone(mode), find: findAnAccount },
    { ...SIDE_TABS, name: `the Account picker at 1024px in ${mode}`, open: pickerBelowSplit(mode), find: findAnAccount },
  ]),
  { ...PRESET_TABS, name: 'the Date presets sheet at 390px', open: datePresetsOnPhone },
  { ...CLIENT_TABS, name: 'the Connection dialog at 390px', open: connectionDialogOnPhone },
];

for (const place of PLACES) {
  const { name } = place;
  const first = firstOf(place);
  const second = secondOf(place);
  const last = lastOf(place);

  test(`moves one tab per swipe in ${name}, left to the next and right to the previous, and never past either end`, async ({ page }) => {
    const root = await place.open(page);
    await showFirst(place, root);
    const panel = panelOf(root);

    await swipe(panel, { dx: RIGHT });
    await waitFrames(page, 10);
    await expectShowing(root, place, first);

    for (const next of place.names.slice(1)) {
      await swipe(panel, { dx: LEFT });
      await expectShowing(root, place, next);
    }
    await swipe(panel, { dx: LEFT });
    await waitFrames(page, 10);
    await expectShowing(root, place, last);

    for (const previous of place.names.slice(0, -1).reverse()) {
      await swipe(panel, { dx: RIGHT });
      await expectShowing(root, place, previous);
    }
    await swipe(panel, { dx: RIGHT });
    await waitFrames(page, 10);
    await expectShowing(root, place, first);
  });

  test(`changes nothing in ${name} for a swipe that is short, mostly vertical, cancelled, started at a screen edge, on the tab strip, on a mouse or a pen`, async ({ page }) => {
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
        await expectShowing(root, place, first);
      });
    }

    await place.tab(root, last).click();
    await expectShowing(root, place, last);
    await swipe(panel, { dx: RIGHT, from: { x: 20, y: 300 } });
    await waitFrames(page, 10);
    await expectShowing(root, place, last);

    await showFirst(place, root);
    await swipe(panel, { dx: LEFT });
    await expectShowing(root, place, second);
  });

  test(`switches tabs in ${name} on a tap, and on the arrow keys, the selected tab and the visible tabpanel agreeing`, async ({ page }) => {
    const root = await place.open(page);
    await showFirst(place, root);

    await place.tab(root, second).click();
    await expectShowing(root, place, second);

    await place.tab(root, second).press('ArrowLeft');
    await expectShowing(root, place, first);
    await place.tab(root, first).press('ArrowRight');
    await expectShowing(root, place, second);
  });

  test(`slides the incoming panel when ${name} switches tab, by tap and by swipe`, async ({ page }) => {
    const root = await place.open(page);
    await showFirst(place, root);
    await waitFrames(page, 40);
    await recordSlides(page);

    await place.tab(root, second).click();
    await expectShowing(root, place, second);
    await expect.poll(() => slideAnimations(page), { timeout: 2000 }).toBeGreaterThan(0);

    await waitFrames(page, 60);
    const before = await slideAnimations(page);
    await swipe(panelOf(root), { dx: RIGHT });
    await expectShowing(root, place, first);
    await expect.poll(() => slideAnimations(page), { timeout: 2000 }).toBeGreaterThan(before);
  });

  test(`switches tab in ${name} with no slide when the User prefers reduced motion, by tap and by swipe`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const root = await place.open(page);
    await showFirst(place, root);
    await waitFrames(page, 40);
    await recordSlides(page);

    await place.tab(root, second).click();
    await expectShowing(root, place, second);
    await swipe(panelOf(root), { dx: RIGHT });
    await expectShowing(root, place, first);
    await swipe(panelOf(root), { dx: LEFT });
    await expectShowing(root, place, second);

    await waitFrames(page, 40);
    expect(await slideAnimations(page)).toBe(0);
  });
}

for (const mode of MODES) {
  test(`keeps switching on every boundary of a swipe in the Account sheet at 390px in ${mode}: from 48px across, from 1.5 times as far across as down, and from just inside either screen edge`, async ({ page }) => {
    const root = await accountSheetOnPhone(mode)(page);
    const panel = panelOf(root);
    const forward: readonly Swipe[] = [
      { dx: -48 },
      { dx: -72, dy: 48 },
      { dx: LEFT, from: { x: PHONE.width - 25, y: 300 } },
    ];

    for (const gesture of forward) {
      await sheetTab(root, 'Debit').click();
      await expectShowing(root, SIDE_TABS, 'Debit');
      await swipe(panel, gesture);
      await expectShowing(root, SIDE_TABS, 'Credit');
    }
    await swipe(panel, { dx: RIGHT, from: { x: 25, y: 300 } });
    await expectShowing(root, SIDE_TABS, 'Debit');
  });

  test(`lets a swipe that starts on an Account at 390px in ${mode} switch tabs without choosing it, and a tap still choose it`, async ({ page }) => {
    const root = await accountSheetOnPhone(mode)(page);
    const chip =
      mode === 'Two-line mode'
        ? accountChoice(root, 'Debit', 'Food')
        : accountTick(root, 'Debit', 'Food');
    const panel = panelOf(root);

    await swipe(chip, { dx: LEFT, click: true }, panel);
    await expectShowing(root, SIDE_TABS, 'Credit');
    await sheetTab(root, 'Debit').click();
    await expectShowing(root, SIDE_TABS, 'Debit');
    await expect(chip).not.toBeChecked();

    await tap(chip, panel);
    await sheetTab(root, 'Debit').click();
    await expect(chip).toBeChecked();
  });
}

async function postSentinel(page: Page): Promise<string> {
  const sentinel = `Swipe sentinel ${randomUUID()}`;
  await postEntries(page, [twoLine({ day: DAY, memo: sentinel })]);
  return sentinel;
}

async function expectNothingPosted(page: Page, sentinel: string, memo: string): Promise<void> {
  await page.goto('/entries');
  await expect(listedEntry(page, sentinel)).toHaveCount(1);
  await expect(listedEntry(page, memo)).toHaveCount(0);
}

test('keeps the day, Title, memo, amounts, Entry lines and a validation message through swipes in the Account sheet at 390px in Multi-line mode, without submitting or closing the sheet', async ({ page }) => {
  const memo = `Swipe keeps ${randomUUID()}`;
  const form = await openMultiLineForm(page);
  const sentinel = `Swipe sentinel ${randomUUID()}`;
  await submitMultiLineEntry(form, {
    day: DAY,
    memo: sentinel,
    lines: [
      { side: 'Debit', account: 'Food', amount: '500' },
      { side: 'Credit', account: 'Cash', amount: '500' },
    ],
  });
  await expect(listedEntry(page, sentinel)).toHaveCount(1);
  await page.setViewportSize(PHONE);
  await fillHeading(entryForm(page), { day: DAY, title: 'Groceries', memo });
  await addLineOnPhone(entryForm(page), { side: 'Debit', account: 'Food', amount: '12500' });
  await addLineOnPhone(entryForm(page), { side: 'Credit', account: 'Cash', amount: '12000' });
  await submit(entryForm(page));
  await expect(entryForm(page).getByRole('alert')).toContainText(/balance/i);

  const sheet = await openAccountSheet(entryForm(page), 'Credit');
  await swipe(panelOf(sheet), { dx: RIGHT });
  await expectShowing(sheet, SIDE_TABS, 'Debit');
  await swipe(panelOf(sheet), { dx: LEFT });
  await expectShowing(sheet, SIDE_TABS, 'Credit');
  await expect(sheet).toBeVisible();
  await pressDone(sheet);

  const kept = entryForm(page);
  await expect(kept.getByLabel('Date')).toHaveValue(DAY);
  await expect(titleField(kept)).toHaveValue('Groceries');
  await expect(kept.getByLabel('Memo')).toHaveValue(memo);
  await expect(lineAmount(kept, 'Debit', 'Food')).toHaveValue(/12,?500/);
  await expect(lineAmount(kept, 'Credit', 'Cash')).toHaveValue(/12,?000/);
  await expect(lineGroups(kept)).toHaveCount(2);
  await expect(kept.getByRole('alert')).toContainText(/balance/i);
  await expectNothingPosted(page, sentinel, memo);
});

test('keeps the day, Title, memo, amount, chosen Accounts and a validation message through swipes in the Account sheet at 390px in Two-line mode, without submitting or closing the sheet', async ({ page }) => {
  const memo = `Swipe keeps ${randomUUID()}`;
  const title = 'T'.repeat(TITLE_MAX + 1);
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const sentinel = await postSentinel(page);
  await page.setViewportSize(PHONE);
  const form = await openEntryForm(page, 'Two-line mode');
  await submitTwoLineEntryOnPhone(form, {
    day: DAY,
    title,
    memo,
    debitAccount: 'Food',
    creditAccount: 'Cash',
    amount: '12500',
  });
  await expect(form.getByRole('alert')).toContainText(/title/i);

  const sheet = await openTwoLineAccountSheet(form, 'Debit');
  await swipe(panelOf(sheet), { dx: LEFT });
  await expectShowing(sheet, SIDE_TABS, 'Credit');
  await expect(accountChoice(sheet, 'Credit', 'Cash')).toBeChecked();
  await swipe(panelOf(sheet), { dx: RIGHT });
  await expectShowing(sheet, SIDE_TABS, 'Debit');
  await expect(accountChoice(sheet, 'Debit', 'Food')).toBeChecked();
  await expect(sheet).toBeVisible();
  await closeButton(sheet).click();
  await expect(sheet).toBeHidden();

  await expect(chooseAccountButton(form, 'Debit')).toContainText('Food');
  await expect(chooseAccountButton(form, 'Credit')).toContainText('Cash');
  await expect(form.getByLabel('Date')).toHaveValue(DAY);
  await expect(titleField(form)).toHaveValue(title);
  await expect(form.getByLabel('Memo')).toHaveValue(memo);
  await expect(form.getByLabel('Amount')).toHaveValue(/12,?500/);
  await expect(form.getByRole('alert')).toContainText(/title/i);
  await expectNothingPosted(page, sentinel, memo);
});

for (const mode of MODES) {
  test(`keeps the day, memo and amounts of Edit entry through swipes in the Account sheet at 390px in ${mode}, without saving or closing the sheet`, async ({ page }) => {
    const dialog = await editDialogOnPhone(page, mode);
    const edited = `Swipe edited ${randomUUID()}`;
    await dialog.getByLabel('Memo').fill(edited);
    const sheet = await openSheetOn(mode, dialog);

    await swipe(panelOf(sheet), { dx: LEFT });
    await expectShowing(sheet, SIDE_TABS, 'Credit');
    await swipe(panelOf(sheet), { dx: RIGHT });
    await expectShowing(sheet, SIDE_TABS, 'Debit');
    await expect(sheet).toBeVisible();
    await leaveSheet(mode, sheet);
    await expect(sheet).toBeHidden();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Date')).toHaveValue(DAY);
    await expect(dialog.getByLabel('Memo')).toHaveValue(edited);
    await expect(
      mode === 'Two-line mode' ? dialog.getByLabel('Amount') : lineAmount(dialog, 'Debit', 'Food'),
    ).toHaveValue(/12,?500/);
    await expect(listedEntry(page, edited)).toHaveCount(0);
  });
}

test('keeps the own tab switches of the form at 390px in Two-line mode: choosing an Account on one Side while the other has none, and a submit finding a Side without one', async ({ page }) => {
  const memo = `Swipe own switch ${randomUUID()}`;
  await page.setViewportSize(PHONE);
  await signIn(page);
  const form = await openEntryForm(page, 'Two-line mode');
  await fillHeading(form, { day: DAY, memo });
  await form.getByLabel('Amount').fill('12500');

  const chosen = await openTwoLineAccountSheet(form, 'Debit');
  await expectShowing(chosen, SIDE_TABS, 'Debit');
  await accountChoice(chosen, 'Debit', 'Food').check();
  await expectShowing(chosen, SIDE_TABS, 'Credit');
  await closeButton(chosen).click();
  await expect(chosen).toBeHidden();

  await submit(form);
  const sheet = accountSheet(page);
  await expect(sheet).toBeVisible();
  await expectShowing(sheet, SIDE_TABS, 'Credit');
});

test('shows the Credit tab by a swipe at 1024px in the Account picker beside the form, and the Debit tab again, keeping the Account chosen', async ({ page }) => {
  await signIn(page);
  const form = await openEntryForm(page, 'Two-line mode');
  await page.setViewportSize(WIDE_BELOW_SPLIT);
  await expect(sheetTab(form, 'Debit')).toBeVisible();

  await accountChoice(form, 'Debit', 'Food').check();
  await expectShowing(form, SIDE_TABS, 'Credit');
  await swipe(panelOf(form), { dx: RIGHT });
  await expectShowing(form, SIDE_TABS, 'Debit');
  await expect(accountChoice(form, 'Debit', 'Food')).toBeChecked();
});

for (const mode of MODES) {
  test(`ignores a swipe on either Side of the Account picker at 1280px in ${mode}, where both Sides show side by side, and slides nothing`, async ({ page }) => {
    await signIn(page);
    await page.setViewportSize(WIDE);
    const form = await openEntryForm(page, mode);
    const panels = form.getByRole('tabpanel');
    await expect(panels).toHaveCount(2);
    await expect(panels.nth(0)).toBeVisible();
    await expect(panels.nth(1)).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(0);
    await waitFrames(page, 40);
    await recordSlides(page);

    await swipe(panels.nth(0), { dx: LEFT });
    await swipe(panels.nth(1), { dx: RIGHT });
    await swipe(panels.nth(0), { dx: RIGHT });
    await swipe(panels.nth(1), { dx: LEFT });

    await waitFrames(page, 40);
    await expect(panels.nth(0)).toBeVisible();
    await expect(panels.nth(1)).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(0);
    expect(await slideAnimations(page)).toBe(0);
  });
}
