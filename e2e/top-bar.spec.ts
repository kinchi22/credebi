import { expect, test, type Page, type ViewportSize } from '@playwright/test';
import { SETTINGS_PATH } from './routes';
import { signIn } from './session';
import { menu, sidebar } from './sidebar';
import { PHONE, WIDE_BELOW_SPLIT } from './viewport';

const TALL_PAGE = SETTINGS_PATH;

const TOP_BAR_HEIGHT = 56;

const PAST_TOP_BAR = TOP_BAR_HEIGHT * 3;

const SHORT_SCROLL = 16;

const scrollY = async (page: Page): Promise<number> => Number(await page.evaluate('window.scrollY'));

const scrollEnd = async (page: Page): Promise<number> =>
  Number(await page.evaluate('document.documentElement.scrollHeight - window.innerHeight'));

async function wheelBy(page: Page, distance: number): Promise<void> {
  const target = Math.min(Math.max((await scrollY(page)) + distance, 0), await scrollEnd(page));
  await page.mouse.wheel(0, distance);
  await expect.poll(() => scrollY(page)).toBe(target);
}

async function scrollToEnd(page: Page): Promise<void> {
  await wheelBy(page, (await scrollEnd(page)) - (await scrollY(page)));
}

async function openTallPage(page: Page, viewport: ViewportSize): Promise<void> {
  await signIn(page);
  await page.setViewportSize(viewport);
  await page.goto(TALL_PAGE);
  expect(await scrollEnd(page), `${TALL_PAGE} scrolls well past the Top bar`).toBeGreaterThan(PAST_TOP_BAR + SHORT_SCROLL);
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
}

test('shows the Top bar at the top of the page at 390px, hides it on the way down and brings it back on a short scroll up, where Menu opens the drawer', async ({ page }) => {
  await openTallPage(page, PHONE);
  await expect(menu(page)).toBeInViewport({ ratio: 1 });

  await wheelBy(page, PAST_TOP_BAR);
  await expect(menu(page)).not.toBeInViewport();

  await wheelBy(page, -SHORT_SCROLL);
  await expect(menu(page)).toBeInViewport({ ratio: 1 });
  expect(await scrollY(page)).toBeGreaterThan(TOP_BAR_HEIGHT);

  await menu(page).click();
  await expect(sidebar(page)).toBeVisible();
});

test('brings a hidden Top bar back at 390px when focus reaches Menu, without scrolling the page', async ({ page }) => {
  await openTallPage(page, PHONE);
  await expect(menu(page)).toBeInViewport({ ratio: 1 });
  await wheelBy(page, PAST_TOP_BAR);
  await expect(menu(page)).not.toBeInViewport();

  await menu(page).focus();
  await expect(menu(page)).toBeInViewport({ ratio: 1 });
  expect(await scrollY(page)).toBe(PAST_TOP_BAR);
});

test('leaves a hidden Top bar hidden at 390px when a scroll goes past the end of the page', async ({ page }) => {
  await openTallPage(page, PHONE);
  await scrollToEnd(page);
  await wheelBy(page, -SHORT_SCROLL);
  await expect(menu(page)).toBeInViewport({ ratio: 1 });

  await scrollToEnd(page);
  await expect(menu(page)).not.toBeInViewport();

  await page.mouse.wheel(0, PAST_TOP_BAR);
  await expect(menu(page)).not.toBeInViewport();
  expect(await scrollY(page)).toBe(await scrollEnd(page));
});

test('has no Top bar at 1024px and keeps the Sidebar in place as the page scrolls', async ({ page }) => {
  await openTallPage(page, WIDE_BELOW_SPLIT);
  await expect(sidebar(page)).toBeInViewport({ ratio: 1 });
  await expect(menu(page)).toBeHidden();

  await scrollToEnd(page);
  await expect(sidebar(page)).toBeInViewport({ ratio: 1 });
  await expect(menu(page)).toBeHidden();
});
