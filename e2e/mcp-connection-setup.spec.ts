import { type Locator, type Page } from '@playwright/test';
import { boxOf, bottom } from './accounts';
import { clickScrim, closeDialog } from './dialog';
import { CATALOGUE, documentLanguage, signUpAfterChoosing, type Language } from './language';
import { connect, expect, mcpUrlOf, MCP_PATH, test } from './oauth';
import { SETTINGS_PATH } from './routes';
import { signIn } from './session';
import {
  addConnectionButton,
  clientGuidance,
  clientTab,
  clientTabs,
  clipboardText,
  connectionDialog,
  connectionsSection,
  connectionSteps,
  copyButton,
  grantClipboard,
  mcpUrlField,
  openConnectionDialog,
  politeLiveRegions,
  startConnectingButton,
} from './settings';
import { expectWithinPhone, PHONE } from './viewport';

const CLIENTS = ['Claude', 'ChatGPT'] as const;

const OTHER_CLIENTS = /\b(?:Muse|Cursor|Gemini|Copilot|Perplexity|Windsurf|Mistral|Grok|DeepSeek)\b/i;

const VENDOR_HELP: Readonly<Record<(typeof CLIENTS)[number], RegExp>> = {
  Claude: /(?:^|\.)(?:claude\.ai|claude\.com|anthropic\.com)$/,
  ChatGPT: /(?:^|\.)(?:openai\.com|chatgpt\.com)$/,
};

const SCRIPT: Readonly<Record<Exclude<Language, 'en'>, RegExp>> = {
  ko: /[\uAC00-\uD7A3]/,
  ja: /[\u3040-\u30FF]/,
};

const ENGLISH_STEP_WORDS = /\b(?:copy|copied|sign in|approve|application)\b/i;

const LONG_HOST = `credebi-${'preview-deployment-'.repeat(4)}of-the-books.example.test`;

type Scrolled = { readonly scrollWidth: number; readonly clientWidth: number };

type Closer = { readonly how: string; readonly close: (dialog: Locator) => Promise<void> };

const CLOSERS: readonly Closer[] = [
  { how: 'its Close button', close: closeDialog },
  { how: 'Escape', close: (dialog) => dialog.page().keyboard.press('Escape') },
  { how: 'a press outside it', close: (dialog) => clickScrim(dialog.page()) },
];

async function openSettings(page: Page): Promise<void> {
  await page.goto(SETTINGS_PATH);
  await expect(connectionsSection(page)).toBeVisible();
}

async function expectClientShown(dialog: Locator, shown: (typeof CLIENTS)[number]): Promise<void> {
  for (const client of CLIENTS) {
    await expect(clientTab(dialog, client)).toHaveAttribute('aria-selected', String(client === shown));
  }
}

async function expectHelpLink(guidance: Locator, client: (typeof CLIENTS)[number]): Promise<void> {
  const links = guidance.getByRole('link');
  await expect(links.first()).toBeVisible();
  const hosts: string[] = [];
  for (const link of await links.all()) {
    hosts.push(new URL((await link.getAttribute('href')) ?? '', 'http://invalid').hostname);
  }
  expect(hosts.some((host) => VENDOR_HELP[client].test(host)), `a link to ${client}'s own help, not ${hosts.join(', ')}`).toBe(true);
}

test('shows at `/settings` an MCP URL that is the origin `/settings` was requested on followed by `/mcp`', async ({ page, baseURL }) => {
  await signIn(page);
  await openSettings(page);

  const dialog = await openConnectionDialog(startConnectingButton(page));

  await expect(mcpUrlField(dialog)).toHaveValue(mcpUrlOf(baseURL));
  await expect(mcpUrlField(dialog)).not.toBeEditable();
});

test('puts exactly the MCP URL on the clipboard with Copy, reads Copied for a moment, and announces it through a polite live region', async ({ page, baseURL }) => {
  await signIn(page);
  await openSettings(page);
  await grantClipboard(page);
  await page.evaluate("navigator.clipboard.writeText('')");
  const dialog = await openConnectionDialog(startConnectingButton(page));
  const copy = dialog.getByRole('button', { name: 'Copy', exact: true });
  await expect(copy).toBeVisible();

  await copy.click();

  await expect.poll(() => clipboardText(page)).toBe(mcpUrlOf(baseURL));
  await expect(dialog.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  await expect(politeLiveRegions(dialog).filter({ hasText: /copied/i }).first()).toBeAttached();
  await expect(copy).toBeVisible();
});

test('explains connecting with Start connecting when the User has no Connection, and offers Add connection beside the Connections heading once they have one', async ({ page, request, client }) => {
  await signIn(page);
  await openSettings(page);

  await expect(startConnectingButton(page)).toBeVisible();
  await expect(addConnectionButton(page)).toHaveCount(0);
  await expect(connectionsSection(page).getByRole('listitem')).toHaveCount(0);
  const dialog = await openConnectionDialog(startConnectingButton(page));
  await expect(connectionDialog(page)).toBeVisible();
  await closeDialog(dialog);
  await expect(dialog).toBeHidden();

  await connect(page, request, client);
  await openSettings(page);

  await expect(addConnectionButton(page)).toBeVisible();
  await expect(startConnectingButton(page)).toHaveCount(0);
  await openConnectionDialog(addConnectionButton(page));
  await expect(connectionDialog(page)).toBeVisible();
});

test('takes the User through three numbered steps: copy the MCP URL, add it to the application, then sign in and approve', async ({ page }) => {
  await signIn(page);
  await openSettings(page);

  const dialog = await openConnectionDialog(startConnectingButton(page));

  await expect(dialog).toHaveAccessibleName(/\S/);
  const steps = connectionSteps(dialog);
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText('MCP URL');
  await expect(mcpUrlField(steps.nth(0))).toBeVisible();
  await expect(steps.nth(0).getByRole('button', { name: 'Copy', exact: true })).toBeVisible();
  await expect(steps.nth(1).getByRole('tablist')).toBeVisible();
  await expect(steps.nth(2)).toContainText(/sign in/i);
  await expect(steps.nth(2)).toContainText(/approve/i);
});

test('guides Claude and ChatGPT in tabs, each with a link to its vendor\'s own help, opening on Claude every time and naming no other client', async ({ page }) => {
  await signIn(page);
  await openSettings(page);

  const dialog = await openConnectionDialog(startConnectingButton(page));

  await expect(clientTabs(dialog)).toHaveCount(CLIENTS.length);
  await expectClientShown(dialog, 'Claude');
  const guidance = clientGuidance(dialog);
  await expect(guidance).toHaveCount(1);
  await expect(guidance).toContainText('claude mcp add --transport http credebi');
  await expect(guidance).toContainText(MCP_PATH);
  await expectHelpLink(guidance, 'Claude');
  await expect(dialog).not.toContainText(OTHER_CLIENTS);

  await clientTab(dialog, 'ChatGPT').click();

  await expectClientShown(dialog, 'ChatGPT');
  await expect(guidance).toHaveCount(1);
  await expect(guidance).toContainText(/developer mode/i);
  await expect(guidance).toContainText('OAuth');
  await expect(guidance).not.toContainText('claude mcp add');
  await expectHelpLink(guidance, 'ChatGPT');
  await expect(dialog).not.toContainText(OTHER_CLIENTS);

  await closeDialog(dialog);
  await expect(dialog).toBeHidden();
  await openConnectionDialog(startConnectingButton(page));

  await expectClientShown(dialog, 'Claude');
  await expect(guidance).toContainText('claude mcp add --transport http credebi');
  await expect(connectionsSection(page)).not.toContainText(OTHER_CLIENTS);
});

for (const { how, close } of CLOSERS) {
  test(`closes the connection dialog by ${how}, returning focus to Start connecting or Add connection, whichever opened it`, async ({ page, request, client }) => {
    await signIn(page);
    await openSettings(page);

    const fromEmpty = await openConnectionDialog(startConnectingButton(page));
    await close(fromEmpty);
    await expect(fromEmpty).toBeHidden();
    await expect(startConnectingButton(page)).toBeFocused();

    await connect(page, request, client);
    await openSettings(page);

    const fromList = await openConnectionDialog(addConnectionButton(page));
    await close(fromList);
    await expect(fromList).toBeHidden();
    await expect(addConnectionButton(page)).toBeFocused();
  });
}

for (const language of ['ko', 'ja'] as const) {
  test(`shows the empty state, the connection dialog and the copy feedback in ${language}`, async ({ page, baseURL }) => {
    const script = SCRIPT[language];
    await signUpAfterChoosing(page, language);
    await page.goto(SETTINGS_PATH);
    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    const section = page.getByRole('region', { name: CATALOGUE[language].connections, exact: true });
    await expect(section).toBeVisible();
    await grantClipboard(page);

    await expect(section).not.toContainText(/connect/i);
    const opener = section.getByRole('button');
    await expect(opener).toHaveCount(1);
    await expect(opener).toHaveAccessibleName(script);

    const dialog = await openConnectionDialog(opener);

    await expect(dialog).toHaveAccessibleName(script);
    await expect(dialog).not.toContainText(ENGLISH_STEP_WORDS);
    const steps = connectionSteps(dialog);
    await expect(steps).toHaveCount(3);
    for (const step of await steps.all()) {
      await expect(step).toContainText(script);
    }
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('textbox')).toHaveValue(mcpUrlOf(baseURL));
    const copy = copyButton(dialog);
    await expect(copy).toHaveAccessibleName(script);

    await copy.click();

    await expect.poll(() => clipboardText(page)).toBe(mcpUrlOf(baseURL));
    const announced = politeLiveRegions(dialog).filter({ hasText: script }).first();
    await expect(announced).toBeAttached();
    await expect(announced).not.toContainText(/copied/i);
    await expect(copy).not.toHaveAccessibleName(/copied/i);
  });
}

test.describe('on a phone', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('opens the connection dialog as a sheet rising from the foot of the screen at 390px', { tag: '@webkit' }, async ({ page }) => {
    await signIn(page);
    await openSettings(page);

    const dialog = await openConnectionDialog(startConnectingButton(page));

    const box = await boxOf(dialog, 'the connection dialog');
    expect(box.x).toBeCloseTo(0, 0);
    expect(box.width).toBeCloseTo(PHONE.width, 0);
    expect(bottom(box)).toBeCloseTo(PHONE.height, 0);
    expect(box.y).toBeGreaterThan(0);
  });

  test('wraps a long MCP URL within the screen at 390px, with no horizontal page scroll', { tag: '@webkit' }, async ({ page }) => {
    await signIn(page);
    await page.route(
      (url) => url.pathname === SETTINGS_PATH,
      async (route) => {
        if (route.request().resourceType() !== 'document') {
          await route.fallback();
          return;
        }
        await route.continue({
          headers: { ...route.request().headers(), 'x-forwarded-host': LONG_HOST, 'x-forwarded-proto': 'https' },
        });
      },
    );
    await openSettings(page);

    const dialog = await openConnectionDialog(startConnectingButton(page));

    const field = mcpUrlField(dialog);
    await expect(field).toHaveValue(`https://${LONG_HOST}${MCP_PATH}`);
    await expectWithinPhone(page, field);
    const hidden = await field.evaluate((element: Scrolled) => element.scrollWidth - element.clientWidth);
    expect(hidden, 'the whole MCP URL shows without scrolling the field').toBeLessThanOrEqual(0);
  });
});
