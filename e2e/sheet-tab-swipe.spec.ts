import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BOOKS_OPEN } from './accounts';
import { shownDay } from './day-input';
import { animationsSeen, incomingFrom, recordSlides, resetAnimations } from './animations';
import { CATEGORIES, choosePeriod, fixToday, periodSheet } from './date-presets';
import {
  AMOUNT,
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
  SIDES,
  submit,
  submitMultiLineEntry,
  submitTwoLineEntry,
  TITLE_MAX,
  titleField,
  twoLine,
  type Side,
} from './entries';
import { ENTRY_SEARCH_PATH, SETTINGS_PATH } from './routes';
import { signIn } from './session';
import {
  MCP_CLIENTS,
  openConnectionDialog,
  startConnectingButton,
  type EntryFormMode,
} from './settings';
import { LEFT, RIGHT, swipe, tap, type Swipe } from './swipe';
import { expectTabSelected, tabOf, tabpanelOf } from './tabs';
import { PHONE, WIDE, WIDE_BELOW_SPLIT, waitFrames } from './viewport';

const MODES: readonly EntryFormMode[] = ['Two-line mode', 'Multi-line mode'];

function at<Item>(list: readonly Item[], index: number): Item {
  const item = list[index];
  if (item === undefined) throw new Error(`there is no item ${String(index)} in ${JSON.stringify(list)}`);
  return item;
}

const ORIGINAL_TITLE = 'Groceries';

const NEW_AMOUNT = '13000';

const SHORT_AMOUNT = '12000';

const DEBIT_PICKS = ['Food', 'Cash'] as const;

const CREDIT_PICKS = ['Cash', 'Salary'] as const;

const TOO_LONG_TITLE = 'T'.repeat(TITLE_MAX + 1);

const DRAFT_TITLE = 'Weekly groceries';

type Outcome = 'refused' | 'valid';

type Draft = {
  readonly title: string;
  readonly memo: string;
  readonly debit: string;
  readonly credit: string;
  readonly refusal?: RegExp;
};

type Own = (root: Locator, forward: boolean, round: number) => Promise<void>;

type Missing = (form: Locator, forward: boolean) => Promise<void>;

type Kit = {
  readonly mode: EntryFormMode;
  readonly openSheet: (scope: Locator) => Promise<Locator>;
  readonly leaveSheet: (sheet: Locator) => Promise<void>;
  readonly chip: (root: Locator) => Locator;
  readonly postOriginal: (form: Locator, memo: string) => Promise<void>;
  readonly chooseAccounts: (scope: Locator, draft: Draft) => Promise<void>;
  readonly fillAmounts: (scope: Locator, draft: Draft) => Promise<void>;
  readonly expectAmounts: (scope: Locator, draft: Draft) => Promise<void>;
  readonly draftOf: (outcome: Outcome, memo: string) => Draft;
  readonly own?: Own;
  readonly missing?: Missing;
};

const chooseOnSide: Own = async (root, forward, round) => {
  const side: Side = forward ? 'Debit' : 'Credit';
  const pick = at(forward ? DEBIT_PICKS : CREDIT_PICKS, round);
  await accountChoice(root, side, pick).check();
};

const leaveASideMissing: Missing = async (form, forward) => {
  await fillHeading(form, { day: DAY, memo: 'Swipe missing side' });
  await form.getByLabel('Amount').fill(AMOUNT);
  if (!forward) await tabOf(form, 'Credit').click();
  await accountChoice(form, forward ? 'Debit' : 'Credit', forward ? 'Food' : 'Cash').check();
};

const TWO_LINE: Kit = {
  mode: 'Two-line mode',
  openSheet: (scope) => openTwoLineAccountSheet(scope, 'Debit'),
  leaveSheet: (sheet) => closeButton(sheet).click(),
  chip: (root) => accountChoice(root, 'Debit', 'Food'),
  postOriginal: (form, memo) => submitTwoLineEntry(form, twoLine({ day: DAY, title: ORIGINAL_TITLE, memo })),
  chooseAccounts: async (scope) => {
    const sheet = await openTwoLineAccountSheet(scope, 'Debit');
    await accountChoice(sheet, 'Debit', 'Food').check();
    await expectShowing(sheet, SIDES, 'Credit');
    await accountChoice(sheet, 'Credit', 'Cash').check();
    await expect(sheet).toBeHidden();
  },
  fillAmounts: (scope, draft) => scope.getByLabel('Amount').fill(draft.debit),
  expectAmounts: async (scope, draft) => {
    await expect(scope.getByLabel('Amount')).toHaveValue(draft.debit);
    await expect(chooseAccountButton(scope, 'Debit')).toContainText('Food');
    await expect(chooseAccountButton(scope, 'Credit')).toContainText('Cash');
  },
  draftOf: (outcome, memo) =>
    outcome === 'refused'
      ? { title: TOO_LONG_TITLE, memo, debit: NEW_AMOUNT, credit: NEW_AMOUNT, refusal: /title/i }
      : { title: DRAFT_TITLE, memo, debit: NEW_AMOUNT, credit: NEW_AMOUNT },
  own: chooseOnSide,
  missing: leaveASideMissing,
};

const MULTI_LINE: Kit = {
  mode: 'Multi-line mode',
  openSheet: (scope) => openAccountSheet(scope, 'Debit'),
  leaveSheet: pressDone,
  chip: (root) => accountTick(root, 'Debit', 'Food'),
  postOriginal: (form, memo) =>
    submitMultiLineEntry(form, {
      day: DAY,
      title: ORIGINAL_TITLE,
      memo,
      lines: [
        { side: 'Debit', account: 'Food', amount: AMOUNT },
        { side: 'Credit', account: 'Cash', amount: AMOUNT },
      ],
    }),
  chooseAccounts: async (scope, draft) => {
    await addLineOnPhone(scope, { side: 'Debit', account: 'Food', amount: draft.debit });
    await addLineOnPhone(scope, { side: 'Credit', account: 'Cash', amount: draft.credit });
  },
  fillAmounts: async (scope, draft) => {
    await lineAmount(scope, 'Debit', 'Food').fill(draft.debit);
    await lineAmount(scope, 'Credit', 'Cash').fill(draft.credit);
  },
  expectAmounts: async (scope, draft) => {
    await expect(lineGroups(scope)).toHaveCount(2);
    await expect(lineAmount(scope, 'Debit', 'Food')).toHaveValue(draft.debit);
    await expect(lineAmount(scope, 'Credit', 'Cash')).toHaveValue(draft.credit);
  },
  draftOf: (outcome, memo) =>
    outcome === 'refused'
      ? { title: DRAFT_TITLE, memo, debit: NEW_AMOUNT, credit: SHORT_AMOUNT, refusal: /balance/i }
      : { title: DRAFT_TITLE, memo, debit: NEW_AMOUNT, credit: NEW_AMOUNT },
};

const KIT_OF: Readonly<Record<EntryFormMode, Kit>> = {
  'Two-line mode': TWO_LINE,
  'Multi-line mode': MULTI_LINE,
};

type Place = {
  readonly name: string;
  readonly names: readonly string[];
  readonly open: (page: Page) => Promise<Locator>;
  readonly find?: (root: Locator) => Locator;
  readonly own?: Own;
  readonly missing?: Missing;
};

async function expectShowing(root: Locator, names: readonly string[], shown: string): Promise<void> {
  await expectTabSelected(root, names, shown);
  await expect(tabpanelOf(root)).toHaveCount(1);
  await expect(tabpanelOf(root)).toBeVisible();
  await expect(tabpanelOf(root)).toHaveAccessibleName(shown);
}

const firstOf = (names: readonly string[]): string => at(names, 0);

const secondOf = (names: readonly string[]): string => at(names, 1);

const lastOf = (names: readonly string[]): string => at(names, names.length - 1);

async function showFirst(names: readonly string[], root: Locator): Promise<void> {
  await tabOf(root, firstOf(names)).click();
  await expectShowing(root, names, firstOf(names));
}

const accountSheetOnPhone =
  (kit: Kit) =>
  async (page: Page): Promise<Locator> => {
    await page.setViewportSize(PHONE);
    await signIn(page);
    return kit.openSheet(await openEntryForm(page, kit.mode));
  };

async function editDialogOnPhone(page: Page, kit: Kit): Promise<{ dialog: Locator; original: string }> {
  const original = `Swipe edit ${randomUUID()}`;
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  await kit.postOriginal(await openEntryForm(page, kit.mode), original);
  await expect(listedEntry(page, original)).toHaveCount(1);
  await page.setViewportSize(PHONE);
  return { dialog: await openEditEntry(listedEntry(page, original)), original };
}

const editSheetOnPhone =
  (kit: Kit) =>
  async (page: Page): Promise<Locator> =>
    kit.openSheet((await editDialogOnPhone(page, kit)).dialog);

const pickerBelowSplit =
  (kit: Kit) =>
  async (page: Page): Promise<Locator> => {
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    const form = await openEntryForm(page, kit.mode);
    await page.setViewportSize(WIDE_BELOW_SPLIT);
    await expect(tabOf(form, 'Debit')).toBeVisible();
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
    const kit = KIT_OF[mode];
    const own = kit.own === undefined ? {} : { own: kit.own };
    const missing = kit.missing === undefined ? {} : { missing: kit.missing };
    return [
      { name: `the Account sheet of the entry form at 390px in ${mode}`, names: SIDES, open: accountSheetOnPhone(kit), find: findAnAccount, ...own },
      { name: `the Account sheet of Edit entry at 390px in ${mode}`, names: SIDES, open: editSheetOnPhone(kit), find: findAnAccount },
      { name: `the Account picker at 1024px in ${mode}`, names: SIDES, open: pickerBelowSplit(kit), find: findAnAccount, ...own, ...missing },
    ];
  }),
  { name: 'the Date presets sheet at 390px', names: CATEGORIES, open: datePresetsOnPhone },
  { name: 'the Connection dialog at 390px', names: MCP_CLIENTS, open: connectionDialogOnPhone },
];

type CauseKind = {
  readonly name: string;
  readonly applies: (place: Place) => boolean;
  readonly prepare?: (place: Place, root: Locator, forward: boolean) => Promise<void>;
  readonly run: (place: Place, root: Locator, forward: boolean, round: number) => Promise<void>;
};

function ownOf(place: Place): Own {
  if (place.own === undefined) throw new Error(`${place.name} has no switch of the form's own`);
  return place.own;
}

function missingOf(place: Place): Missing {
  if (place.missing === undefined) throw new Error(`${place.name} has no submit that finds a Side missing`);
  return place.missing;
}

const CAUSE_KINDS: readonly CauseKind[] = [
  {
    name: 'a tap',
    applies: () => true,
    run: (place, root, forward) => tabOf(root, forward ? secondOf(place.names) : firstOf(place.names)).click(),
  },
  {
    name: 'an arrow key',
    applies: () => true,
    run: (place, root, forward) =>
      forward
        ? tabOf(root, firstOf(place.names)).press('ArrowRight')
        : tabOf(root, secondOf(place.names)).press('ArrowLeft'),
  },
  {
    name: 'a swipe',
    applies: () => true,
    run: (_place, root, forward) => swipe(tabpanelOf(root), { dx: forward ? LEFT : RIGHT }),
  },
  {
    name: 'the own rules of the form',
    applies: (place) => place.own !== undefined,
    run: (place, root, forward, round) => ownOf(place)(root, forward, round),
  },
  {
    name: 'a submit that finds a Side without an Account',
    applies: (place) => place.missing !== undefined,
    prepare: (place, root, forward) => missingOf(place)(root, forward),
    run: (_place, root) => submit(root),
  },
];

for (const place of PLACES) {
  const { name, names } = place;
  const first = firstOf(names);
  const second = secondOf(names);
  const last = lastOf(names);

  test(`moves one tab per swipe in ${name}, left to the next and right to the previous, and never past either end`, async ({ page }) => {
    const root = await place.open(page);
    await showFirst(names, root);
    const panel = tabpanelOf(root);

    await swipe(panel, { dx: RIGHT });
    await waitFrames(page, 10);
    await expectShowing(root, names, first);

    for (const next of names.slice(1)) {
      await swipe(panel, { dx: LEFT });
      await expectShowing(root, names, next);
    }
    await swipe(panel, { dx: LEFT });
    await waitFrames(page, 10);
    await expectShowing(root, names, last);

    for (const previous of names.slice(0, -1).reverse()) {
      await swipe(panel, { dx: RIGHT });
      await expectShowing(root, names, previous);
    }
    await swipe(panel, { dx: RIGHT });
    await waitFrames(page, 10);
    await expectShowing(root, names, first);
  });

  test(`changes nothing in ${name} for a swipe that is short, mostly vertical, cancelled, started at a screen edge, on a mouse or a pen, and still switches for one that is not`, async ({ page }) => {
    const root = await place.open(page);
    await showFirst(names, root);
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
        await expectShowing(root, names, first);
      });
    }

    await tabOf(root, last).click();
    await expectShowing(root, names, last);
    await swipe(panel, { dx: RIGHT, from: { x: 20, y: 300 } });
    await waitFrames(page, 10);
    await expectShowing(root, names, last);

    await showFirst(names, root);
    await swipe(panel, { dx: LEFT });
    await expectShowing(root, names, second);
  });

  test(`changes nothing in ${name} for a swipe that starts on the tab strip${place.find === undefined ? '' : ' or on Find an account'}, and still switches for one on the panel`, async ({ page }) => {
    const root = await place.open(page);
    await showFirst(names, root);
    const outside = [root.getByRole('tablist'), ...(place.find === undefined ? [] : [place.find(root)])];

    for (const target of outside) {
      await swipe(target, { dx: LEFT });
      await waitFrames(page, 10);
      await expectShowing(root, names, first);
    }

    await swipe(tabpanelOf(root), { dx: LEFT });
    await expectShowing(root, names, second);
  });

  test(`switches tabs in ${name} on a tap, and on the arrow keys, the selected tab and the visible tabpanel agreeing`, async ({ page }) => {
    const root = await place.open(page);
    await showFirst(names, root);

    await tabOf(root, second).click();
    await expectShowing(root, names, second);

    await tabOf(root, second).press('ArrowLeft');
    await expectShowing(root, names, first);
    await tabOf(root, first).press('ArrowRight');
    await expectShowing(root, names, second);
  });

  for (const kind of CAUSE_KINDS.filter((each) => each.applies(place))) {
    for (const forward of [true, false]) {
      const from = forward ? first : second;
      const to = forward ? second : first;
      const direction = forward ? 'a later tab, from the right' : 'an earlier tab, from the left';

      test(`slides the incoming panel of ${name} in from its tab's side when ${kind.name} moves to ${direction}, and not when the User prefers reduced motion`, async ({ page }) => {
        const root = await place.open(page);
        await kind.prepare?.(place, root, forward);
        await tabOf(root, from).click();
        await expectShowing(root, names, from);
        await waitFrames(page, 40);
        await recordSlides(page);

        await kind.run(place, root, forward, 0);
        await expectShowing(root, names, to);
        await expect.poll(() => animationsSeen(page), { timeout: 2000 }).toBeGreaterThan(0);
        await waitFrames(page, 40);
        expect(await incomingFrom(page)).toBe(forward ? 'right' : 'left');

        await tabOf(root, from).click();
        await expectShowing(root, names, from);
        await waitFrames(page, 60);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await resetAnimations(page);
        await kind.run(place, root, forward, 1);
        await expectShowing(root, names, to);
        await waitFrames(page, 40);
        expect(await animationsSeen(page)).toBe(0);
        expect(await incomingFrom(page)).toBe('none');
      });
    }
  }
}

for (const mode of MODES) {
  const kit = KIT_OF[mode];

  test(`switches at the edges of the thresholds of a swipe in the Account sheet at 390px in ${mode}, and not one step inside them`, async ({ page }) => {
    const root = await accountSheetOnPhone(kit)(page);
    const panel = tabpanelOf(root);
    const right = PHONE.width - 25;
    const inside = PHONE.width - 24;
    const pairs: readonly (readonly [string, Swipe, Swipe])[] = [
      ['48px across', { dx: -48 }, { dx: -47 }],
      ['1.5 times as far across as down', { dx: -72, dy: 48 }, { dx: -72, dy: 49 }],
      ['25px from the right edge', { dx: LEFT, from: { x: right, y: 300 } }, { dx: LEFT, from: { x: inside, y: 300 } }],
    ];

    for (const [what, switches, stays] of pairs) {
      await test.step(what, async () => {
        await tabOf(root, 'Debit').click();
        await expectShowing(root, SIDES, 'Debit');
        await swipe(panel, stays);
        await waitFrames(page, 10);
        await expectShowing(root, SIDES, 'Debit');
        await swipe(panel, switches);
        await expectShowing(root, SIDES, 'Credit');
      });
    }

    await swipe(panel, { dx: RIGHT, from: { x: 24, y: 300 } });
    await waitFrames(page, 10);
    await expectShowing(root, SIDES, 'Credit');
    await swipe(panel, { dx: RIGHT, from: { x: 25, y: 300 } });
    await expectShowing(root, SIDES, 'Debit');
  });

  test(`lets a swipe that starts on an Account at 390px in ${mode} switch tabs without choosing it, and a tap still choose it`, async ({ page }) => {
    const root = await accountSheetOnPhone(kit)(page);
    const chip = kit.chip(root);
    const panel = tabpanelOf(root);

    await swipe(chip, { dx: LEFT, click: true }, panel);
    await expectShowing(root, SIDES, 'Credit');
    await tabOf(root, 'Debit').click();
    await expectShowing(root, SIDES, 'Debit');
    await expect(chip).not.toBeChecked();

    await tap(chip, panel);
    await tabOf(root, 'Debit').click();
    await expect(chip).toBeChecked();
  });
}

type ContextKit = {
  readonly fresh: boolean;
  readonly submitName: 'Add entry' | 'Save';
  readonly prepare: (page: Page, kit: Kit) => Promise<{ scope: Locator; anchor: (other: Page) => Promise<void> }>;
  readonly commit: (scope: Locator) => Promise<void>;
};

const CONTEXTS: Readonly<Record<'entry form' | 'Edit entry', ContextKit>> = {
  'entry form': {
    fresh: true,
    submitName: 'Add entry',
    prepare: async (page, kit) => {
      await signIn(page, { accountsStartOn: BOOKS_OPEN });
      const sentinel = `Swipe sentinel ${randomUUID()}`;
      await postEntries(page, [twoLine({ day: DAY, memo: sentinel })]);
      await page.setViewportSize(PHONE);
      return {
        scope: await openEntryForm(page, kit.mode),
        anchor: (other) => expect(listedEntry(other, sentinel)).toHaveCount(1),
      };
    },
    commit: (scope) => submit(scope),
  },
  'Edit entry': {
    fresh: false,
    submitName: 'Save',
    prepare: async (page, kit) => {
      const { dialog, original } = await editDialogOnPhone(page, kit);
      return {
        scope: dialog,
        anchor: (other) =>
          expect(listedEntry(other, original)).toContainText(
            headingShowing({ day: DAY, title: ORIGINAL_TITLE, memo: original }),
          ),
      };
    },
    commit: saveEdit,
  },
};

async function fillDraft(scope: Locator, kit: Kit, draft: Draft, fresh: boolean): Promise<void> {
  if (fresh) await kit.chooseAccounts(scope, draft);
  await fillHeading(scope, { day: DAY, title: draft.title, memo: draft.memo });
  await kit.fillAmounts(scope, draft);
}

async function expectDraft(scope: Locator, kit: Kit, draft: Draft): Promise<void> {
  await expect(scope.getByLabel('Date')).toHaveValue(shownDay(DAY));
  await expect(titleField(scope)).toHaveValue(draft.title);
  await expect(scope.getByLabel('Memo')).toHaveValue(draft.memo);
  await kit.expectAmounts(scope, draft);
  if (draft.refusal !== undefined) await expect(scope.getByRole('alert')).toContainText(draft.refusal);
}

for (const context of ['entry form', 'Edit entry'] as const) {
  const where = CONTEXTS[context];

  for (const mode of MODES) {
    const kit = KIT_OF[mode];

    for (const outcome of ['refused', 'valid'] as const) {
      const keeps =
        outcome === 'refused'
          ? 'the day, Title, memo, amounts, Entry lines and the validation message of a refused submit'
          : 'the day, Title, memo, amounts and Entry lines, with nothing submitted or saved until the User does';

      test(`keeps ${keeps} through swipes in the Account sheet of the ${context} at 390px in ${mode}, without closing the sheet`, async ({ page }) => {
        const memo = `Swipe draft ${randomUUID()}`;
        const draft = kit.draftOf(outcome, memo);
        const { scope, anchor } = await where.prepare(page, kit);
        await fillDraft(scope, kit, draft, where.fresh);
        if (draft.refusal !== undefined) {
          await submit(scope, where.submitName);
          await expect(scope.getByRole('alert')).toContainText(draft.refusal);
        }

        const sheet = await kit.openSheet(scope);
        await swipe(tabpanelOf(sheet), { dx: LEFT });
        await expectShowing(sheet, SIDES, 'Credit');
        await swipe(tabpanelOf(sheet), { dx: RIGHT });
        await expectShowing(sheet, SIDES, 'Debit');
        await expect(sheet).toBeVisible();
        await kit.leaveSheet(sheet);
        await expect(sheet).toBeHidden();

        await expect(scope).toBeVisible();
        await expectDraft(scope, kit, draft);

        const other = await page.context().newPage();
        await other.setViewportSize(PHONE);
        await other.goto('/entries');
        await anchor(other);
        await expect(listedEntry(other, memo)).toHaveCount(0);
        if (outcome === 'refused') {
          await other.close();
          return;
        }

        await where.commit(scope);
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
  await signIn(page, { accountsStartOn: BOOKS_OPEN });
  const form = await openEntryForm(page, 'Two-line mode');
  await fillHeading(form, { day: DAY, memo });
  await form.getByLabel('Amount').fill(AMOUNT);

  const chosen = await openTwoLineAccountSheet(form, 'Debit');
  await expectShowing(chosen, SIDES, 'Debit');
  await accountChoice(chosen, 'Debit', 'Food').check();
  await expectShowing(chosen, SIDES, 'Credit');
  await closeButton(chosen).click();
  await expect(chosen).toBeHidden();

  await submit(form);
  const sheet = accountSheet(page);
  await expect(sheet).toBeVisible();
  await expectShowing(sheet, SIDES, 'Credit');
});

test('shows the Credit tab by a swipe at 1024px in the Account picker beside the form, and the Debit tab again, keeping the Account chosen', async ({ page }) => {
  const form = await pickerBelowSplit(TWO_LINE)(page);

  await accountChoice(form, 'Debit', 'Food').check();
  await expectShowing(form, SIDES, 'Credit');
  await swipe(tabpanelOf(form), { dx: RIGHT });
  await expectShowing(form, SIDES, 'Debit');
  await expect(accountChoice(form, 'Debit', 'Food')).toBeChecked();
});

for (const mode of MODES) {
  test(`ignores a swipe on either Side of the Account picker at 1280px in ${mode}, where both Sides show side by side, and slides nothing, while the same swipe switches at 1024px`, async ({ page }) => {
    await signIn(page);
    await page.setViewportSize(WIDE);
    const form = await openEntryForm(page, mode);
    const panels = tabpanelOf(form);
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
    await expectShowing(form, SIDES, 'Debit');
    await swipe(tabpanelOf(form), { dx: LEFT });
    await expectShowing(form, SIDES, 'Credit');
    await expect.poll(() => animationsSeen(page), { timeout: 2000 }).toBeGreaterThan(0);
  });
}
