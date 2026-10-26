import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { accountsSection, BOOKS_OPEN, boxOf, openAdd } from './accounts';
import { closeDialog, discardChanges, discardDialog, keepEditing } from './dialog';
import { listedEntry, openEditEntry, postEntries, twoLine } from './entries';
import { ENTRY_SEARCH_PATH, SETTINGS_PATH } from './routes';
import { signIn } from './session';
import { menu, sidebar } from './sidebar';
import { PHONE, WIDE } from './viewport';

const SHORT_PHONE = { width: PHONE.width, height: 400 } as const;

const SHORT_WIDE = { width: WIDE.width, height: 480 } as const;

const START = 60;

const DISTANCE = 200;

const SCRIM_GAP = 8;

const EDGE_INSET = 8;

type Point = { readonly x: number; readonly y: number };

type ScrollBy = (page: Page, at: Point, distance: number) => Promise<void>;

const scrollY = async (page: Page): Promise<number> => Number(await page.evaluate('window.scrollY'));

const scrollEnd = async (page: Page): Promise<number> =>
  Number(await page.evaluate('document.documentElement.scrollHeight - window.innerHeight'));

const SETTLE_FRAMES = 10;

async function settled(page: Page): Promise<void> {
  await page.evaluate(
    `new Promise((resolve) => { let left = ${String(SETTLE_FRAMES)}; const next = () => { left -= 1; if (left === 0) resolve(); else requestAnimationFrame(next); }; requestAnimationFrame(next); })`,
  );
}

const wheel: ScrollBy = async (page, at, distance) => {
  await page.mouse.move(at.x, at.y);
  await page.mouse.wheel(0, distance);
  await settled(page);
};

const SWIPE_STEPS = 10;

const swipe: ScrollBy = async (page, at, distance) => {
  const cdp = await page.context().newCDPSession(page);
  const height = page.viewportSize()?.height ?? 0;
  const touchAt = (y: number): { x: number; y: number }[] => [{ x: at.x, y: Math.min(Math.max(y, 1), height - 1) }];
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
  await settled(page);
};

const middleOf = async (locator: Locator): Promise<Point> => {
  const box = await boxOf(locator, 'the element to scroll over');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function scrimBeside(page: Page, modal: Locator): Promise<Point> {
  const box = await boxOf(modal, 'the modal');
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('the page has no viewport');
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

async function scrollPageToStart(page: Page): Promise<void> {
  expect(await scrollEnd(page), 'the page behind the modal can scroll').toBeGreaterThan(START);
  await page.evaluate(`window.scrollTo(0, ${String(START)})`);
  await expect.poll(() => scrollY(page)).toBe(START);
}

async function expectBackgroundStill(page: Page, at: Point, inputs: readonly ScrollBy[]): Promise<void> {
  for (const input of inputs) {
    for (const distance of [DISTANCE, -DISTANCE]) {
      await input(page, at, distance);
      expect(await scrollY(page)).toBe(START);
    }
  }
}

const TOUCH_INPUT = [swipe, wheel] as const;

async function openSettings(page: Page): Promise<void> {
  await signIn(page);
  await page.goto(SETTINGS_PATH);
  await expect(accountsSection(page)).toBeVisible();
}

const nameField = (dialog: Locator): Locator => dialog.getByLabel('Name', { exact: true });

test.describe('on a touch phone', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('keeps the page still under a swipe or a wheel over the scrim while Add account is open at 390px', async ({ page }) => {
    await openSettings(page);
    const dialog = await openAdd(page, 'Assets', 'account');
    await scrollPageToStart(page);

    await expectBackgroundStill(page, await scrimBeside(page, dialog), TOUCH_INPUT);
    await expect(dialog).toBeVisible();
  });

  test('keeps the page still under a swipe or a wheel over the scrim while the Sidebar drawer is open at 390px', async ({ page }) => {
    await openSettings(page);
    await menu(page).click();
    await expect(sidebar(page)).toBeVisible();
    await scrollPageToStart(page);

    await expectBackgroundStill(page, await scrimBeside(page, sidebar(page)), TOUCH_INPUT);
    await expect(sidebar(page)).toBeVisible();
  });

  test('keeps the page locked under Add account once Discard changes is closed with Keep editing, and lets it scroll from where it was once the last dialog closes', async ({ page }) => {
    await openSettings(page);
    const dialog = await openAdd(page, 'Assets', 'account');
    const draft = `Draft ${randomUUID()}`;
    await nameField(dialog).fill(draft);
    await scrollPageToStart(page);
    const scrim = await scrimBeside(page, dialog);

    await closeDialog(dialog);
    await expect(discardDialog(page)).toBeVisible();
    await expectBackgroundStill(page, scrim, TOUCH_INPUT);

    await keepEditing(dialog, nameField(dialog), draft);
    await expectBackgroundStill(page, scrim, TOUCH_INPUT);

    await closeDialog(dialog);
    await discardChanges(dialog);
    expect(await scrollY(page)).toBe(START);

    await swipe(page, scrim, DISTANCE);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(START);
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
    await page.getByRole('button', { name: 'Choose a period', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Choose a period', exact: true });
    await expect(sheet).toBeVisible();
    await scrollPageToStart(page);

    const header = sheet.getByRole('heading', { name: 'Choose a period', exact: true });
    await expectBackgroundStill(page, await middleOf(header), TOUCH_INPUT);
    await expect(sheet).toBeVisible();
  });
});

type Scroller = { readonly scrollTop: number; readonly scrollHeight: number; readonly clientHeight: number };

const formScroller = (form: Locator): Locator => form.locator('xpath=..');

const formTop = (form: Locator): Promise<number> =>
  formScroller(form).evaluate((scroller: Scroller) => Math.round(scroller.scrollTop));

const formEnd = (form: Locator): Promise<number> =>
  formScroller(form).evaluate((scroller: Scroller) => Math.round(scroller.scrollHeight - scroller.clientHeight));

async function formEdge(form: Locator): Promise<Point> {
  const box = await boxOf(formScroller(form), 'the scrolling body of Edit entry');
  return { x: box.x + box.width - EDGE_INSET, y: box.y + box.height / 2 };
}

const DEVICES = [
  { name: 'a touch device', viewport: SHORT_PHONE, hasTouch: true, input: swipe },
  { name: 'a fine pointer', viewport: SHORT_WIDE, hasTouch: false, input: wheel },
] as const;

for (const { name, viewport, hasTouch, input } of DEVICES) {
  test(`scrolls the form inside Edit entry on ${name}, and leaves the page still when it scrolls past either end`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: WIDE, hasTouch });
    try {
      const page = await context.newPage();
      await signIn(page, { accountsStartOn: BOOKS_OPEN });
      const memo = `Edit entry scroll ${randomUUID()}`;
      await postEntries(page, [twoLine({ day: '2026-09-15', memo })]);
      await page.setViewportSize(viewport);
      await page.goto('/entries');

      const dialog = await openEditEntry(listedEntry(page, memo));
      const form = dialog.getByRole('form');
      await scrollPageToStart(page);
      const end = await formEnd(form);
      const edge = await formEdge(form);
      expect(end, 'the form is taller than Edit entry').toBeGreaterThan(0);

      await input(page, edge, Math.min(DISTANCE / 4, end));
      await expect.poll(() => formTop(form)).toBeGreaterThan(0);
      expect(await scrollY(page)).toBe(START);

      await expect(async () => {
        await input(page, edge, DISTANCE);
        expect(await formTop(form)).toBe(end);
      }).toPass();
      await input(page, edge, DISTANCE);
      expect(await scrollY(page)).toBe(START);
      expect(await formTop(form)).toBe(end);

      await expect(async () => {
        await input(page, edge, -DISTANCE);
        expect(await formTop(form)).toBe(0);
      }).toPass();
      await input(page, edge, -DISTANCE);
      expect(await scrollY(page)).toBe(START);
      await expect(dialog).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

test('keeps the page in place sideways while Add account opens and closes on a fine pointer at 1280px', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await openSettings(page);
  const section = accountsSection(page);
  const before = await boxOf(section, 'the Accounts section');
  const width = async (): Promise<number> => Number(await page.evaluate('document.documentElement.clientWidth'));
  const widthBefore = await width();

  const dialog = await openAdd(page, 'Assets', 'account');
  expect((await boxOf(section, 'the Accounts section')).x).toBe(before.x);
  expect(await width()).toBe(widthBefore);

  await closeDialog(dialog);
  await expect(dialog).toBeHidden();
  expect((await boxOf(section, 'the Accounts section')).x).toBe(before.x);
  expect(await width()).toBe(widthBefore);
});
