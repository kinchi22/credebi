import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accountsSection,
  BOOKS_OPEN,
  boxOf,
  centre,
  nameField,
  openAdd,
  type Point,
} from './accounts';
import { choosePeriod, periodSheet } from './date-presets';
import { closeDialog, discardChanges, discardDialog, keepEditing } from './dialog';
import { accountChoices, listedEntry, openEditEntry, postEntries, twoLine } from './entries';
import { ENTRY_SEARCH_PATH, SETTINGS_PATH } from './routes';
import { signIn } from './session';
import { menu, sidebar } from './sidebar';
import { PHONE, scrollEnd, scrollY, viewportOf, WIDE } from './viewport';

const SHORT_PHONE = { width: PHONE.width, height: 400 } as const;

const SHORT_WIDE = { width: WIDE.width, height: 480 } as const;

const PAGE_SCROLLED_TO = 60;

const DISTANCE = 200;

const SCRIM_GAP = 8;

const EDGE_INSET = 8;

const FRAMES_AFTER_INPUT = 10;

const SWIPE_STEPS = 10;

type ScrollBy = (page: Page, at: Point, distance: number) => Promise<void>;

async function waitFramesAfterInput(page: Page): Promise<void> {
  await page.evaluate(
    `new Promise((resolve) => { let left = ${String(FRAMES_AFTER_INPUT)}; const next = () => { left -= 1; if (left === 0) resolve(); else requestAnimationFrame(next); }; requestAnimationFrame(next); })`,
  );
}

async function wheel(page: Page, at: Point, distance: number): Promise<void> {
  await page.mouse.move(at.x, at.y);
  await page.mouse.wheel(0, distance);
  await waitFramesAfterInput(page);
}

async function swipe(page: Page, at: Point, distance: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const { height } = viewportOf(page);
  const touchAt = (y: number): Point[] => [{ x: at.x, y: Math.min(Math.max(y, 1), height - 1) }];
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchAt(at.y) });
    for (let step = 1; step <= SWIPE_STEPS; step += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: touchAt(at.y - (distance * step) / SWIPE_STEPS),
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  await waitFramesAfterInput(page);
}

const SWIPE_AND_WHEEL: readonly ScrollBy[] = [swipe, wheel];

async function scrimBeside(page: Page, modal: Locator): Promise<Point> {
  const box = await boxOf(modal, 'the modal');
  const viewport = viewportOf(page);
  const gaps = [
    { size: box.x, at: { x: box.x / 2, y: viewport.height / 2 } },
    {
      size: viewport.width - box.x - box.width,
      at: { x: (box.x + box.width + viewport.width) / 2, y: viewport.height / 2 },
    },
  ];
  const widest = gaps.reduce((best, gap) => (gap.size > best.size ? gap : best));
  expect(widest.size, 'the scrim shows beside the modal').toBeGreaterThanOrEqual(SCRIM_GAP);
  return widest.at;
}

async function scrollPageBehindModal(page: Page): Promise<void> {
  expect(await scrollEnd(page), 'the page behind the modal can scroll').toBeGreaterThan(PAGE_SCROLLED_TO);
  await page.evaluate(`window.scrollTo(0, ${String(PAGE_SCROLLED_TO)})`);
  await expect.poll(() => scrollY(page)).toBe(PAGE_SCROLLED_TO);
}

async function expectPageStill(page: Page, at: Point, inputs: readonly ScrollBy[]): Promise<void> {
  for (const input of inputs) {
    for (const distance of [DISTANCE, -DISTANCE]) {
      await input(page, at, distance);
      expect(await scrollY(page)).toBe(PAGE_SCROLLED_TO);
    }
  }
}

async function openSettings(page: Page): Promise<void> {
  await signIn(page);
  await page.goto(SETTINGS_PATH);
  await expect(accountsSection(page)).toBeVisible();
}

test.describe('on a touch phone', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('keeps the page still under a swipe or a wheel over the scrim while Add account is open at 390px', async ({ page }) => {
    await openSettings(page);
    const dialog = await openAdd(page, 'Assets', 'account');
    await scrollPageBehindModal(page);

    await expectPageStill(page, await scrimBeside(page, dialog), SWIPE_AND_WHEEL);
    await expect(dialog).toBeVisible();
  });

  test('keeps the page still under a swipe or a wheel over the scrim while the Sidebar drawer is open at 390px', async ({ page }) => {
    await openSettings(page);
    await menu(page).click();
    await expect(sidebar(page)).toBeVisible();
    await scrollPageBehindModal(page);

    await expectPageStill(page, await scrimBeside(page, sidebar(page)), SWIPE_AND_WHEEL);
    await expect(sidebar(page)).toBeVisible();
  });

  test('keeps the page locked under Add account once Discard changes is closed with Keep editing, and lets it scroll from where it was once the last dialog closes', async ({ page }) => {
    await openSettings(page);
    const dialog = await openAdd(page, 'Assets', 'account');
    const draft = `Draft ${randomUUID()}`;
    await nameField(dialog).fill(draft);
    await scrollPageBehindModal(page);
    const scrim = await scrimBeside(page, dialog);

    await closeDialog(dialog);
    await expect(discardDialog(page)).toBeVisible();
    await expectPageStill(page, scrim, SWIPE_AND_WHEEL);

    await keepEditing(dialog, nameField(dialog), draft);
    await expectPageStill(page, scrim, SWIPE_AND_WHEEL);

    await closeDialog(dialog);
    await discardChanges(dialog);
    expect(await scrollY(page)).toBe(PAGE_SCROLLED_TO);

    await swipe(page, scrim, DISTANCE);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(PAGE_SCROLLED_TO);
  });

  test('hides the page overflow while the Sidebar drawer is open, and shows it again once the drawer closes', { tag: '@webkit' }, async ({ page }) => {
    await signIn(page);
    const root = page.locator('html');
    await expect(menu(page)).toBeVisible();
    await expect(root).toHaveCSS('overflow', 'visible');

    await menu(page).click();
    await expect(sidebar(page)).toBeVisible();
    await expect(root).toHaveCSS('overflow', 'hidden');

    await page.keyboard.press('Escape');
    await expect(sidebar(page)).toBeHidden();
    await expect(root).toHaveCSS('overflow', 'visible');
  });
});

test.describe('on a short touch phone', () => {
  test.use({ viewport: SHORT_PHONE, hasTouch: true });

  test('keeps the page still under a swipe or a wheel over the header of Choose a period at 390px', async ({ page }) => {
    await signIn(page);
    await page.goto(ENTRY_SEARCH_PATH);
    await choosePeriod(page).click();
    const sheet = periodSheet(page);
    await expect(sheet).toBeVisible();
    await scrollPageBehindModal(page);

    const header = sheet.getByRole('heading', { name: 'Choose a period', exact: true });
    await expectPageStill(page, centre(await boxOf(header, 'the header of Choose a period')), SWIPE_AND_WHEEL);
    await expect(sheet).toBeVisible();
  });
});

type Scroller = { readonly scrollTop: number; readonly scrollHeight: number; readonly clientHeight: number };

const formBody = (dialog: Locator): Locator =>
  dialog.locator('div').filter({ has: dialog.page().getByRole('form') }).last();

const formTop = (body: Locator): Promise<number> =>
  body.evaluate((scroller: Scroller) => Math.round(scroller.scrollTop));

const formEnd = (body: Locator): Promise<number> =>
  body.evaluate((scroller: Scroller) => Math.round(scroller.scrollHeight - scroller.clientHeight));

async function formEdge(body: Locator): Promise<Point> {
  const box = await boxOf(body, 'the scrolling body of Edit entry');
  return { x: box.x + box.width - EDGE_INSET, y: box.y + box.height / 2 };
}

const DEVICES = [
  { name: 'a touch device', viewport: SHORT_PHONE, hasTouch: true, input: swipe },
  { name: 'a fine pointer', viewport: SHORT_WIDE, hasTouch: false, input: wheel },
] as const;

for (const { name, viewport, hasTouch, input } of DEVICES) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport: WIDE, hasTouch });

    test(`scrolls the form inside Edit entry on ${name}, and leaves the page still when it scrolls past either end`, async ({ page }) => {
      await signIn(page, { accountsStartOn: BOOKS_OPEN });
      const memo = `Edit entry scroll ${randomUUID()}`;
      await postEntries(page, [twoLine({ day: '2026-09-15', memo })]);
      await page.setViewportSize(viewport);
      await page.goto('/entries');

      const dialog = await openEditEntry(listedEntry(page, memo));
      const body = formBody(dialog);
      await scrollPageBehindModal(page);
      const end = await formEnd(body);
      const edge = await formEdge(body);
      expect(end, 'the form is taller than Edit entry').toBeGreaterThan(0);

      await input(page, edge, Math.min(DISTANCE / 4, end));
      await expect.poll(() => formTop(body)).toBeGreaterThan(0);
      expect(await scrollY(page)).toBe(PAGE_SCROLLED_TO);

      await expect(async () => {
        await input(page, edge, DISTANCE);
        expect(await formTop(body)).toBe(end);
      }).toPass();
      await input(page, edge, DISTANCE);
      expect(await scrollY(page)).toBe(PAGE_SCROLLED_TO);
      expect(await formTop(body)).toBe(end);

      await expect(async () => {
        await input(page, edge, -DISTANCE);
        expect(await formTop(body)).toBe(0);
      }).toPass();
      await input(page, edge, -DISTANCE);
      expect(await scrollY(page)).toBe(PAGE_SCROLLED_TO);
      await expect(dialog).toBeVisible();
    });
  });
}

async function visibleCentre(target: Locator, within: Locator): Promise<Point> {
  const shown = await boxOf(target, 'the account picker');
  const frame = await boxOf(within, 'the scrolling body of Edit entry');
  const top = Math.max(shown.y, frame.y);
  const bottom = Math.min(shown.y + shown.height, frame.y + frame.height);
  expect(bottom - top, 'the account picker shows inside Edit entry').toBeGreaterThan(2 * EDGE_INSET);
  return { x: shown.x + shown.width / 2, y: (top + bottom) / 2 };
}

test.describe('on a short fine pointer at 1280 x 480', () => {
  test.use({ viewport: WIDE, hasTouch: false });

  test('scrolls the form inside Edit entry under a wheel over the account picker', async ({ page }) => {
    await signIn(page, { accountsStartOn: BOOKS_OPEN });
    const memo = `Edit entry picker scroll ${randomUUID()}`;
    await postEntries(page, [twoLine({ day: '2026-09-15', memo })]);
    await page.setViewportSize(SHORT_WIDE);
    await page.goto('/entries');

    const dialog = await openEditEntry(listedEntry(page, memo));
    const body = formBody(dialog);
    const end = await formEnd(body);
    expect(end, 'the form is taller than Edit entry').toBeGreaterThan(0);
    expect(await formTop(body)).toBe(0);

    await wheel(page, await visibleCentre(accountChoices(dialog, 'Debit'), body), Math.min(DISTANCE / 4, end));
    await expect.poll(() => formTop(body)).toBeGreaterThan(0);
    await expect(dialog).toBeVisible();
  });
});

test.describe('on a fine pointer at 1280px', () => {
  test.use({ viewport: WIDE, hasTouch: false });

  test('keeps the page in place sideways while Add account opens and closes', async ({ page }) => {
    await openSettings(page);
    const section = accountsSection(page);
    const sectionX = async (): Promise<number> => (await boxOf(section, 'the Accounts section')).x;
    const width = async (): Promise<number> => Number(await page.evaluate('document.documentElement.clientWidth'));
    const xBefore = await sectionX();
    const widthBefore = await width();

    const dialog = await openAdd(page, 'Assets', 'account');
    expect(await sectionX()).toBe(xBefore);
    expect(await width()).toBe(widthBefore);

    await closeDialog(dialog);
    await expect(dialog).toBeHidden();
    expect(await sectionX()).toBe(xBefore);
    expect(await width()).toBe(widthBefore);
  });

  test('lets the page scroll under a wheel over the scrim while Add account is open', async ({ page }) => {
    await openSettings(page);
    const dialog = await openAdd(page, 'Assets', 'account');
    await scrollPageBehindModal(page);

    await wheel(page, await scrimBeside(page, dialog), DISTANCE);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(PAGE_SCROLLED_TO);
    await expect(dialog).toBeVisible();
  });
});
