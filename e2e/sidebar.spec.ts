import { expect, test, type Locator, type Page } from '@playwright/test';
import { entryForm, entrySearchForm } from './entries';
import { ENTRIES_URL, ENTRY_SEARCH_WITHOUT_QUERY, SETTINGS_URL, SIGN_IN_URL } from './routes';
import { signIn } from './session';
import { entryFormModes } from './settings';
import { SIGNED_IN_PAGES, menu, sidebar } from './sidebar';
import { PHONE, WIDE_BELOW_SPLIT } from './viewport';

const TALL_PAGE = '/settings';

const TOP_BAR_HEIGHT = 56;

const PAST_TOP_BAR = TOP_BAR_HEIGHT * 3;

const SHORT_SCROLL = 16;

const scrollTop = async (page: Page): Promise<number> => Number(await page.evaluate('window.scrollY'));

const scrollEnd = async (page: Page): Promise<number> =>
  Number(await page.evaluate('document.documentElement.scrollHeight - window.innerHeight'));

async function scrollBy(page: Page, distance: number): Promise<void> {
  const target = Math.min(Math.max((await scrollTop(page)) + distance, 0), await scrollEnd(page));
  await page.mouse.wheel(0, distance);
  await expect.poll(() => scrollTop(page)).toBe(target);
}

async function scrollToEnd(page: Page): Promise<void> {
  await scrollBy(page, (await scrollEnd(page)) - (await scrollTop(page)));
}

async function openTallPage(page: Page, viewport: typeof PHONE | typeof WIDE_BELOW_SPLIT): Promise<void> {
  await signIn(page);
  await page.setViewportSize(viewport);
  await page.goto(TALL_PAGE);
  expect(await scrollEnd(page), `${TALL_PAGE} scrolls well past the Top bar`).toBeGreaterThan(PAST_TOP_BAR + SHORT_SCROLL);
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
}

const sidebarLink = (page: Page, name: 'Entries' | 'Entry search' | 'Settings'): Locator =>
  sidebar(page).getByRole('link', { name, exact: true });

const sidebarSignOut = (page: Page): Locator =>
  sidebar(page).getByRole('button', { name: 'Sign out' });

test('shows the Sidebar on every signed-in page, with links to Entries, Entry search and Settings and the only Sign out', async ({ page }) => {
  await signIn(page);

  for (const path of SIGNED_IN_PAGES) {
    await page.goto(path);
    await expect(sidebarLink(page, 'Entries')).toBeVisible();
    await expect(sidebarLink(page, 'Entry search')).toBeVisible();
    await expect(sidebarLink(page, 'Settings')).toBeVisible();
    await expect(sidebarSignOut(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(1);
  }
});

test('moves between the signed-in pages through the Sidebar', async ({ page }) => {
  await signIn(page);

  await sidebarLink(page, 'Entry search').click();
  await expect(page).toHaveURL(ENTRY_SEARCH_WITHOUT_QUERY);
  await expect(entrySearchForm(page)).toBeVisible();

  await sidebarLink(page, 'Settings').click();
  await expect(page).toHaveURL(SETTINGS_URL);
  await expect(entryFormModes(page)).toBeVisible();

  await sidebarLink(page, 'Entries').click();
  await expect(page).toHaveURL(ENTRIES_URL);
  await expect(entryForm(page)).toBeVisible();
});

test('ends the Session when the User signs out from the Sidebar', async ({ page }) => {
  await signIn(page);
  await page.goto('/settings');

  await sidebarSignOut(page).click();
  await expect(page).not.toHaveURL(SETTINGS_URL);

  await page.goto('/settings');
  await expect(page).toHaveURL(SIGN_IN_URL);
});

test('shows no Sidebar once the visitor is no longer signed in', async ({ page }) => {
  await signIn(page);
  await expect(sidebar(page)).toBeVisible();
  await sidebarSignOut(page).click();
  await expect(page).not.toHaveURL(ENTRIES_URL);

  await page.goto('/');
  await expect(page.getByTestId('health')).toBeVisible();
  await expect(sidebar(page)).toHaveCount(0);

  await page.goto('/sign-in');
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
  await expect(sidebar(page)).toHaveCount(0);
});

test('puts the Sidebar behind a Menu button at 390px, whose drawer holds the links and Sign out', async ({ page }) => {
  await signIn(page);
  await expect(sidebar(page)).toBeVisible();
  await expect(menu(page)).toBeHidden();

  await page.setViewportSize(PHONE);

  for (const path of SIGNED_IN_PAGES) {
    await page.goto(path);
    await expect(menu(page)).toBeVisible();
    await expect(sidebar(page)).toBeHidden();

    await menu(page).click();
    await expect(sidebarLink(page, 'Entries')).toBeVisible();
    await expect(sidebarLink(page, 'Entry search')).toBeVisible();
    await expect(sidebarLink(page, 'Settings')).toBeVisible();
    await expect(sidebarSignOut(page)).toBeVisible();
  }

  await sidebarLink(page, 'Entry search').click();
  await expect(page).toHaveURL(ENTRY_SEARCH_WITHOUT_QUERY);
  await expect(entrySearchForm(page)).toBeVisible();
});

test('focuses the drawer, not a Sidebar link, when Menu opens it, and Tab then focuses Entries', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize(PHONE);

  await menu(page).click();
  await expect(sidebar(page)).toBeFocused();
  await expect(sidebarLink(page, 'Entries')).not.toBeFocused();
  await expect(sidebarLink(page, 'Entry search')).not.toBeFocused();
  await expect(sidebarLink(page, 'Settings')).not.toBeFocused();

  await page.keyboard.press('Tab');
  const entries = sidebarLink(page, 'Entries');
  await expect(entries).toBeFocused();
  await expect(entries.and(page.locator(':focus-visible'))).toBeVisible();
});

test('shows the Top bar at the top of the page at 390px, hides it on the way down and brings it back on a short scroll up, where Menu opens the drawer', async ({ page }) => {
  await openTallPage(page, PHONE);
  await expect(menu(page)).toBeInViewport({ ratio: 1 });

  await scrollBy(page, PAST_TOP_BAR);
  await expect(menu(page)).not.toBeInViewport();

  await scrollBy(page, -SHORT_SCROLL);
  await expect(menu(page)).toBeInViewport({ ratio: 1 });
  expect(await scrollTop(page)).toBeGreaterThan(TOP_BAR_HEIGHT);

  await menu(page).click();
  await expect(sidebar(page)).toBeVisible();
});

test('brings a hidden Top bar back at 390px when focus reaches Menu, without scrolling the page', async ({ page }) => {
  await openTallPage(page, PHONE);
  await scrollBy(page, PAST_TOP_BAR);
  await expect(menu(page)).not.toBeInViewport();

  await menu(page).focus();
  await expect(menu(page)).toBeInViewport({ ratio: 1 });
  expect(await scrollTop(page)).toBe(PAST_TOP_BAR);
});

test('leaves a hidden Top bar hidden at 390px when a scroll goes past the end of the page', async ({ page }) => {
  await openTallPage(page, PHONE);
  await scrollToEnd(page);
  await scrollBy(page, -SHORT_SCROLL);
  await expect(menu(page)).toBeInViewport({ ratio: 1 });

  await scrollToEnd(page);
  await expect(menu(page)).not.toBeInViewport();

  await page.mouse.wheel(0, PAST_TOP_BAR);
  await expect(menu(page)).not.toBeInViewport();
  expect(await scrollTop(page)).toBe(await scrollEnd(page));
});

test('has no Top bar at 1024px and keeps the Sidebar in place as the page scrolls', async ({ page }) => {
  await openTallPage(page, WIDE_BELOW_SPLIT);
  await expect(menu(page)).toBeHidden();
  await expect(sidebar(page)).toBeInViewport({ ratio: 1 });

  await scrollToEnd(page);
  await expect(menu(page)).toBeHidden();
  await expect(sidebar(page)).toBeInViewport({ ratio: 1 });
});
