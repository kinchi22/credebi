import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import { animationsSeen, resetAnimations } from './animations';
import { CATEGORIES, choosePeriod, fixToday, periodSheet } from './date-presets';
import {
  accountChoice,
  accountSheet,
  accountTick,
  addLineOnPhone,
  chooseAccountButton,
  closeButton,
  DAY,
  findAnAccount,
  fillHeading,
  headingShowing,
  lineAmount,
  lineGroups,
  listedEntry,
  openAccountSheet,
  openEditEntry,
  openEntryForm,
  openTwoLineAccountSheet,
  postEntries,
  pressDone,
  saveEdit,
  sheetTab,
  SIDES,
  submit,
  submitMultiLineEntry,
  submitTwoLineEntry,
  TITLE_MAX,
  titleField,
  twoLine,
} from './entries';
import { ENTRY_SEARCH_PATH, SETTINGS_PATH } from './routes';
import { signIn } from './session';
import {
  clientGuidance as tabpanelOf,
  clientTab,
  MCP_CLIENTS,
  openConnectionDialog,
  startConnectingButton,
  type EntryFormMode,
  type McpClientName,
} from './settings';
import { LEFT, recordSlides, RIGHT, swipe, tap, type Swipe } from './swipe';
import { PHONE, WIDE, WIDE_BELOW_SPLIT, waitFrames } from './viewport';

const MODES: readonly EntryFormMode[] = ['Two-line mode', 'Multi-line mode'];

const DEBIT_PICKS = ['Food', 'Cash'] as const;

type Tabs = {
  readonly names: readonly string[];
  readonly tab: (root: Locator, name: string) => Locator;
};

type Place = Tabs & {
  readonly name: string;
  readonly open: (page: Page) => Promise<Locator>;
  readonly find?: (root: Locator) => Locator;
  readonly own?: (root: Locator, round: number) => Promise<void>;
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
  await expect(tabpanelOf(root)).toHaveCount(1);
  await expect(tabpanelOf(root)).toBeVisible();
  await expect(tabpanelOf(root)).toHaveAccessibleName(name);
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

const chooseDebit = async (root: Locator, round: number): Promise<void> => {
  await accountChoice(root, 'Debit', DEBIT_PICKS[round % DEBIT_PICKS.length] ?? 'Food').check();
};

const accountSheetOnPhone =
  (mode: EntryFormMode) =>
  async (page: Page): Promise<Locator> => {
    await page.setViewportSize(PHONE);
    await signIn(page);
    return openSheetOn(mode, await openEntryForm(page, mode));
  };

const ORIGINAL_TITLE = 'Groceries';

async function postForEditing(page: Page, mode: EntryFormMode): Promise<string> {
  const memo = `Swipe edit ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const form = await openEntryForm(page, mode);
  if (mode === 'Two-line mode') {
    await submitTwoLineEntry(form, twoLine({ day: DAY, title: ORIGINAL_TITLE, memo }));
  } else {
    await submitMultiLineEntry(form, {
      day: DAY,
      title: ORIGINAL_TITLE,
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

async function editDialogOnPhone(page: Page, mode: EntryFormMode): Promise<{ dialog: Locator; original: string }> {
  const original = await postForEditing(page, mode);
  await page.setViewportSize(PHONE);
  return { dialog: await openEditEntry(listedEntry(page, original)), original };
}

const editSheetOnPhone =
  (mode: EntryFormMode) =>
  async (page: Page): Promise<Locator> =>
    openSheetOn(mode, (await editDialogOnPhone(page, mode)).dialog);

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
  ...MODES.flatMap((mode): readonly Place[] => {
    const own = mode === 'Two-line mode' ? { own: chooseDebit } : {};
    return [
      { ...SIDE_TABS, ...own, name: `the Account sheet of the entry form at 390px in ${mode}`, open: accountSheetOnPhone(mode), find: findAnAccount },
      { ...SIDE_TABS, name: `the Account sheet of Edit entry at 390px in ${mode}`, open: editSheetOnPhone(mode), find: findAnAccount },
      { ...SIDE_TABS, ...own, name: `the Account picker at 1024px in ${mode}`, open: pickerBelowSplit(mode), find: findAnAccount },
    ];
  }),
  { ...PRESET_TABS, name: 'the Date presets sheet at 390px', open: datePresetsOnPhone },
  { ...CLIENT_TABS, name: 'the Connection dialog at 390px', open: connectionDialogOnPhone },
];

type Cause = {
  readonly name: string;
  readonly applies: (place: Place) => boolean;
  readonly to: (place: Place) => string;
  readonly run: (place: Place, root: Locator, round: number) => Promise<void>;
};

const CAUSES: readonly Cause[] = [
  {
    name: 'a tap',
    applies: () => true,
    to: secondOf,
    run: (place, root) => place.tab(root, secondOf(place)).click(),
  },
  {
    name: 'an arrow key',
    applies: () => true,
    to: secondOf,
    run: (place, root) => place.tab(root, firstOf(place)).press('ArrowRight'),
  },
  {
    name: 'a swipe',
    applies: () => true,
    to: secondOf,
    run: (_place, root) => swipe(tabpanelOf(root), { dx: LEFT }),
  },
  {
    name: 'the own rules of the form',
    applies: (place) => place.own !== undefined,
    to: () => 'Credit',
    run: (place, root, round) => place.own?.(root, round) ?? Promise.resolve(),
  },
];

for (const place of PLACES) {
  const { name } = place;
  const first = firstOf(place);
  const second = secondOf(place);
  const last = lastOf(place);

  test(`moves one tab per swipe in ${name}, left to the next and right to the previous, and never past either end`, async ({ page }) => {
    const root = await place.open(page);
    await showFirst(place, root);
    const panel = tabpanelOf(root);

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

  test(`changes nothing in ${name} for a swipe that is short, mostly vertical, cancelled, started at a screen edge, on a mouse or a pen, and still switches for one that is not`, async ({ page }) => {
    const root = await place.open(page);
    await showFirst(place, root);
    const panel = tabpanelOf(root);
    const width = (page.viewportSize() ?? PHONE).width;
    const ignored: readonly (readonly [string, Swipe])[] = [
      ['under 48px', { dx: -47 }],
      ['under 1.5 times as far across as down', { dx: LEFT, dy: 70 }],
      ['vertical', { dx: 0, dy: 120 }],
      ['cancelled', { dx: LEFT, cancel: true }],
      ['from the right edge', { dx: LEFT, from: { x: width - 20, y: 300 } }],
      ['by mouse', { dx: LEFT, pointer: 'mouse' }],
      ['by pen', { dx: LEFT, pointer: 'pen' }],
    ];

    for (const [what, gesture] of ignored) {
      await test.step(`a swipe ${what}`, async () => {
        await swipe(panel, gesture);
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

  test(`changes nothing in ${name} for a swipe that starts on the tab strip${place.find === undefined ? '' : ' or on Find an account'}, and still switches for one on the panel`, async ({ page }) => {
    const root = await place.open(page);
    await showFirst(place, root);
    const outside = [root.getByRole('tablist'), ...(place.find === undefined ? [] : [place.find(root)])];

    for (const target of outside) {
      await swipe(target, { dx: LEFT });
      await waitFrames(page, 10);
      await expectShowing(root, place, first);
    }

    await swipe(tabpanelOf(root), { dx: LEFT });
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

  for (const cause of CAUSES.filter((each) => each.applies(place))) {
    test(`slides the incoming panel when ${cause.name} switches the tab of ${name}, and does not when the User prefers reduced motion`, async ({ page }) => {
      const root = await place.open(page);
      await showFirst(place, root);
      await waitFrames(page, 40);
      await recordSlides(page);

      await cause.run(place, root, 0);
      await expectShowing(root, place, cause.to(place));
      await expect.poll(() => animationsSeen(page), { timeout: 2000 }).toBeGreaterThan(0);

      await showFirst(place, root);
      await waitFrames(page, 60);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await resetAnimations(page);
      await cause.run(place, root, 1);
      await expectShowing(root, place, cause.to(place));
      await waitFrames(page, 40);
      expect(await animationsSeen(page)).toBe(0);
    });
  }
}

for (const mode of MODES) {
  test(`switches at the edges of the thresholds of a swipe in the Account sheet at 390px in ${mode}, and not one step inside them`, async ({ page }) => {
    const root = await accountSheetOnPhone(mode)(page);
    const panel = tabpanelOf(root);
    const right = PHONE.width - 25;
    const pairs: readonly (readonly [string, Swipe, Swipe])[] = [
      ['48px across', { dx: -48 }, { dx: -47 }],
      ['1.5 times as far across as down', { dx: -72, dy: 48 }, { dx: -72, dy: 49 }],
      ['25px from the right edge', { dx: LEFT, from: { x: right, y: 300 } }, { dx: LEFT, from: { x: right + 5, y: 300 } }],
    ];

    for (const [what, switches, stays] of pairs) {
      await test.step(what, async () => {
        await sheetTab(root, 'Debit').click();
        await expectShowing(root, SIDE_TABS, 'Debit');
        await swipe(panel, stays);
        await waitFrames(page, 10);
        await expectShowing(root, SIDE_TABS, 'Debit');
        await swipe(panel, switches);
        await expectShowing(root, SIDE_TABS, 'Credit');
      });
    }

    await swipe(panel, { dx: RIGHT, from: { x: 20, y: 300 } });
    await waitFrames(page, 10);
    await expectShowing(root, SIDE_TABS, 'Credit');
    await swipe(panel, { dx: RIGHT, from: { x: 25, y: 300 } });
    await expectShowing(root, SIDE_TABS, 'Debit');
  });

  test(`lets a swipe that starts on an Account at 390px in ${mode} switch tabs without choosing it, and a tap still choose it`, async ({ page }) => {
    const root = await accountSheetOnPhone(mode)(page);
    const chip =
      mode === 'Two-line mode'
        ? accountChoice(root, 'Debit', 'Food')
        : accountTick(root, 'Debit', 'Food');
    const panel = tabpanelOf(root);

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

type Outcome = 'refused' | 'valid';

type Draft = {
  readonly title: string;
  readonly memo: string;
  readonly debit: string;
  readonly credit: string;
  readonly refusal?: RegExp;
};

const TOO_LONG_TITLE = 'T'.repeat(TITLE_MAX + 1);

const DRAFT_TITLE = 'Weekly groceries';

function draftOf(mode: EntryFormMode, outcome: Outcome, memo: string): Draft {
  if (mode === 'Two-line mode') {
    return outcome === 'refused'
      ? { title: TOO_LONG_TITLE, memo, debit: '13000', credit: '13000', refusal: /title/i }
      : { title: DRAFT_TITLE, memo, debit: '13000', credit: '13000' };
  }
  return outcome === 'refused'
    ? { title: DRAFT_TITLE, memo, debit: '13000', credit: '12000', refusal: /balance/i }
    : { title: DRAFT_TITLE, memo, debit: '13000', credit: '13000' };
}

const amountShown = (amount: string): RegExp => new RegExp(amount.replace(/(\d)(?=(\d{3})+$)/g, '$1,?'));

async function chooseAccountsOnPhone(scope: Locator, mode: EntryFormMode, draft: Draft): Promise<void> {
  if (mode === 'Multi-line mode') {
    await addLineOnPhone(scope, { side: 'Debit', account: 'Food', amount: draft.debit });
    await addLineOnPhone(scope, { side: 'Credit', account: 'Cash', amount: draft.credit });
    return;
  }
  const sheet = await openTwoLineAccountSheet(scope, 'Debit');
  await accountChoice(sheet, 'Debit', 'Food').check();
  await expectShowing(sheet, SIDE_TABS, 'Credit');
  await accountChoice(sheet, 'Credit', 'Cash').check();
  await expect(sheet).toBeHidden();
}

async function fillDraft(scope: Locator, mode: EntryFormMode, draft: Draft, fresh: boolean): Promise<void> {
  if (fresh) await chooseAccountsOnPhone(scope, mode, draft);
  await fillHeading(scope, { day: DAY, title: draft.title, memo: draft.memo });
  if (mode === 'Two-line mode') {
    await scope.getByLabel('Amount').fill(draft.debit);
  } else {
    await lineAmount(scope, 'Debit', 'Food').fill(draft.debit);
    await lineAmount(scope, 'Credit', 'Cash').fill(draft.credit);
  }
}

async function expectDraft(scope: Locator, mode: EntryFormMode, draft: Draft): Promise<void> {
  await expect(scope.getByLabel('Date')).toHaveValue(DAY);
  await expect(titleField(scope)).toHaveValue(draft.title);
  await expect(scope.getByLabel('Memo')).toHaveValue(draft.memo);
  if (mode === 'Two-line mode') {
    await expect(scope.getByLabel('Amount')).toHaveValue(amountShown(draft.debit));
    await expect(chooseAccountButton(scope, 'Debit')).toContainText('Food');
    await expect(chooseAccountButton(scope, 'Credit')).toContainText('Cash');
  } else {
    await expect(lineGroups(scope)).toHaveCount(2);
    await expect(lineAmount(scope, 'Debit', 'Food')).toHaveValue(amountShown(draft.debit));
    await expect(lineAmount(scope, 'Credit', 'Cash')).toHaveValue(amountShown(draft.credit));
  }
  if (draft.refusal !== undefined) await expect(scope.getByRole('alert')).toContainText(draft.refusal);
}

for (const context of ['entry form', 'Edit entry'] as const) {
  for (const mode of MODES) {
    for (const outcome of ['refused', 'valid'] as const) {
      const keeps =
        outcome === 'refused'
          ? 'the day, Title, memo, amounts, Entry lines and the validation message of a refused submit'
          : 'the day, Title, memo, amounts and Entry lines, with nothing submitted or saved until the User does';

      test(`keeps ${keeps} through swipes in the Account sheet of the ${context} at 390px in ${mode}, without closing the sheet`, async ({ page }) => {
        const memo = `Swipe draft ${randomUUID()}`;
        const draft = draftOf(mode, outcome, memo);
        let scope: Locator;
        let anchor: (other: Page) => Promise<void>;
        if (context === 'entry form') {
          await signIn(page, { accountsStartOn: BOOKS_OPEN });
          const sentinel = `Swipe sentinel ${randomUUID()}`;
          await postEntries(page, [twoLine({ day: DAY, memo: sentinel })]);
          await page.setViewportSize(PHONE);
          scope = await openEntryForm(page, mode);
          anchor = (other) => expect(listedEntry(other, sentinel)).toHaveCount(1);
        } else {
          const edit = await editDialogOnPhone(page, mode);
          scope = edit.dialog;
          anchor = (other) =>
            expect(listedEntry(other, edit.original)).toContainText(
              headingShowing({ day: DAY, title: ORIGINAL_TITLE, memo: edit.original }),
            );
        }
        await fillDraft(scope, mode, draft, context === 'entry form');
        if (draft.refusal !== undefined) {
          await submit(scope, context === 'entry form' ? 'Add entry' : 'Save');
          await expect(scope.getByRole('alert')).toContainText(draft.refusal);
        }

        const sheet = await openSheetOn(mode, scope);
        await swipe(tabpanelOf(sheet), { dx: LEFT });
        await expectShowing(sheet, SIDE_TABS, 'Credit');
        await swipe(tabpanelOf(sheet), { dx: RIGHT });
        await expectShowing(sheet, SIDE_TABS, 'Debit');
        await expect(sheet).toBeVisible();
        await leaveSheet(mode, sheet);
        await expect(sheet).toBeHidden();

        await expect(scope).toBeVisible();
        await expectDraft(scope, mode, draft);
        if (outcome === 'refused') return;

        const other = await page.context().newPage();
        await other.setViewportSize(PHONE);
        await other.goto('/entries');
        await anchor(other);
        await expect(listedEntry(other, memo)).toHaveCount(0);

        if (context === 'entry form') {
          await submit(scope);
        } else {
          await saveEdit(scope);
        }
        await expect(listedEntry(page, memo)).toHaveCount(1);
        await other.reload();
        await expect(listedEntry(other, memo)).toHaveCount(1);
        await other.close();
      });
    }
  }
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
  const form = await pickerBelowSplit('Two-line mode')(page);

  await accountChoice(form, 'Debit', 'Food').check();
  await expectShowing(form, SIDE_TABS, 'Credit');
  await swipe(tabpanelOf(form), { dx: RIGHT });
  await expectShowing(form, SIDE_TABS, 'Debit');
  await expect(accountChoice(form, 'Debit', 'Food')).toBeChecked();
});

for (const mode of MODES) {
  test(`ignores a swipe on either Side of the Account picker at 1280px in ${mode}, where both Sides show side by side, and slides nothing, while the same swipe switches at 1024px`, async ({ page }) => {
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
    expect(await animationsSeen(page)).toBe(0);

    await page.setViewportSize(WIDE_BELOW_SPLIT);
    await expectShowing(form, SIDE_TABS, 'Debit');
    await swipe(tabpanelOf(form), { dx: LEFT });
    await expectShowing(form, SIDE_TABS, 'Credit');
    await expect.poll(() => animationsSeen(page), { timeout: 2000 }).toBeGreaterThan(0);
  });
}
