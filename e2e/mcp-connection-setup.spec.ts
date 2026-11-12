import { type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { boxOf, bottom } from './accounts';
import { clickScrim, closeDialog } from './dialog';
import { escaped } from './entries';
import { CATALOGUE, documentLanguage, signUpAfterChoosing } from './language';
import { expectUnauthorized, listTools, mcpPost } from './mcp';
import {
  connect,
  expect,
  expectInvalidGrant,
  LOOPBACK_HOST,
  MCP_PATH,
  mcpUrlOf,
  originOf,
  refreshWith,
  SCOPE_SHOWN,
  test,
  type Connected,
} from './oauth';
import { SETTINGS_PATH } from './routes';
import { signIn } from './session';
import {
  addConnectionButton,
  clientGuidance,
  clientStep,
  clientTab,
  clientTabs,
  clipboardText,
  connectionItems,
  connectionsSection,
  copyButton,
  firstStep,
  grantClipboard,
  lastStep,
  liveRegions,
  MCP_CLIENTS,
  mcpUrlField,
  openConnectionDialog,
  refuseClipboardWrites,
  revokeConnection,
  revokeConnectionButton,
  revokeDialog,
  startConnectingButton,
  stepCount,
  type McpClientName,
} from './settings';
import { expectWithinPhone, PHONE } from './viewport';

const OTHER_CLIENTS = /\b(?:Muse|Cursor|Gemini|Copilot|Perplexity|Windsurf|Mistral|Grok|DeepSeek)\b/i;

const VENDOR_HELP: Readonly<Record<McpClientName, RegExp>> = {
  Claude: /(?:^|\.)(?:claude\.ai|claude\.com|anthropic\.com)$/,
  ChatGPT: /(?:^|\.)(?:openai\.com|chatgpt\.com)$/,
};

const CLAUDE_CODE_COMMAND = 'claude mcp add --transport http credebi';

const LETTER_OF: Readonly<Record<'ko' | 'ja', RegExp>> = {
  ko: /[\uAC00-\uD7A3]/,
  ja: /[\u3040-\u30FF]/,
};

const ENGLISH_CONTROL_WORDS = /\b(?:start|connect|copy|copied|close)\b/i;

const COPIED = /copied/i;

const LONG_HOST = `credebi-${'preview-deployment-'.repeat(4)}of-the-books.example.test`;

type Scrolled = { readonly scrollWidth: number; readonly clientWidth: number };

type Selectable = {
  readonly value: string;
  readonly selectionStart: number | null;
  readonly selectionEnd: number | null;
};

type Closer = { readonly how: string; readonly close: (dialog: Locator) => Promise<void> };

const CLOSERS: readonly Closer[] = [
  { how: 'its Close button', close: closeDialog },
  { how: 'Escape', close: (dialog) => dialog.page().keyboard.press('Escape') },
  { how: 'a press outside it', close: (dialog) => clickScrim(dialog.page()) },
];

async function openSettings(page: Page, title?: string): Promise<Locator> {
  await page.goto(SETTINGS_PATH);
  const section = connectionsSection(page, title);
  await expect(section).toBeVisible();
  return section;
}

async function explanationBeside(section: Locator, opener: Locator): Promise<string> {
  await expect(opener).toBeVisible();
  const heading = await section.getByRole('heading').first().innerText();
  const button = await opener.innerText();
  return (await section.innerText()).replace(heading, '').replace(button, '').trim();
}

async function expectClientShown(dialog: Locator, shown: McpClientName): Promise<void> {
  for (const client of MCP_CLIENTS) {
    await expect(clientTab(dialog, client)).toHaveAttribute('aria-selected', String(client === shown));
  }
}

async function expectHelpLink(guidance: Locator, client: McpClientName): Promise<void> {
  const links = guidance.getByRole('link');
  await expect(links.first()).toBeVisible();
  const hosts: string[] = [];
  for (const link of await links.all()) {
    hosts.push(new URL((await link.getAttribute('href')) ?? '', 'http://invalid').hostname);
  }
  expect(hosts.some((host) => VENDOR_HELP[client].test(host)), `a link to ${client}'s own help, not ${hosts.join(', ')}`).toBe(true);
}

async function expectRevoked(request: APIRequestContext, revoked: Connected, origin: string): Promise<void> {
  await expectUnauthorized(await mcpPost(request, revoked.tokens.accessToken, 'tools/list'), origin);
  await expectInvalidGrant(
    await refreshWith(request, revoked.authorization.clientId, revoked.tokens.refreshToken),
  );
}

test('shows at `/settings` an MCP URL that is the origin `/settings` was requested on followed by `/mcp`', async ({ page, baseURL }) => {
  await signIn(page);
  await openSettings(page);

  const dialog = await openConnectionDialog(startConnectingButton(page));

  await expect(mcpUrlField(dialog)).toHaveValue(mcpUrlOf(baseURL));
  await expect(mcpUrlField(dialog)).not.toBeEditable();
});

test('puts exactly the MCP URL on the clipboard with Copy, reads Copied for a moment, and announces the copy through a live region that held no such message before', async ({ page, baseURL }) => {
  await signIn(page);
  await openSettings(page);
  await grantClipboard(page);
  await page.evaluate("navigator.clipboard.writeText('')");
  const dialog = await openConnectionDialog(startConnectingButton(page));
  const copy = copyButton(dialog);
  await expect(copy).toHaveAccessibleName('Copy');
  await expect(liveRegions(dialog).filter({ hasText: COPIED })).toHaveCount(0);

  await copy.click();

  await expect.poll(() => clipboardText(page)).toBe(mcpUrlOf(baseURL));
  await expect(copy).toHaveAccessibleName('Copied');
  await expect(liveRegions(dialog).filter({ hasText: COPIED }).first()).toBeAttached();
  await expect(copy).toHaveAccessibleName('Copy');
});

test('selects the MCP URL and asks the User to copy it themselves when the browser refuses the clipboard', async ({ page, baseURL }) => {
  await signIn(page);
  await refuseClipboardWrites(page);
  await openSettings(page);
  const dialog = await openConnectionDialog(startConnectingButton(page));
  const field = mcpUrlField(dialog);
  await expect(field).toHaveValue(mcpUrlOf(baseURL));
  const announced = liveRegions(dialog).filter({ hasText: /\S/ });
  await expect(announced).toHaveCount(0);

  await copyButton(dialog).click();

  await expect(announced.first()).toBeAttached();
  await expect(announced.first()).not.toContainText(COPIED);
  await expect(copyButton(dialog)).not.toHaveAccessibleName(COPIED);
  const selected = await field.evaluate((element: Selectable) =>
    element.value.slice(element.selectionStart ?? 0, element.selectionEnd ?? 0),
  );
  expect(selected).toBe(mcpUrlOf(baseURL));
});

test('explains connecting beside Start connecting when the User has no Connection, and offers Add connection beside the Connections heading once they have one', async ({ page, request, client }) => {
  await signIn(page);
  const section = await openSettings(page);

  expect(await explanationBeside(section, startConnectingButton(page))).toMatch(/\p{L}{2,}.*\p{L}{2,}/su);
  await expect(addConnectionButton(page)).toHaveCount(0);
  const dialog = await openConnectionDialog(startConnectingButton(page));
  await closeDialog(dialog);
  await expect(dialog).toBeHidden();

  await connect(page, request, client);
  await openSettings(page);

  await expect(connectionItems(page, client.name)).toHaveCount(1);
  await expect(addConnectionButton(page)).toBeVisible();
  await expect(startConnectingButton(page)).toHaveCount(0);
  await openConnectionDialog(addConnectionButton(page));
});

test('takes the User through three numbered steps: copy the MCP URL, add it to the application, then sign in and approve', async ({ page }) => {
  await signIn(page);
  await openSettings(page);

  const dialog = await openConnectionDialog(startConnectingButton(page));

  await expect(dialog).toHaveAccessibleName(/\S/);
  await expect.poll(() => stepCount(dialog)).toBe(3);
  await expect(mcpUrlField(firstStep(dialog))).toBeVisible();
  await expect(copyButton(dialog)).toHaveAccessibleName('Copy');
  await expect(clientStep(dialog)).toHaveCount(1);
  await expect(lastStep(dialog)).toContainText(/sign in/i);
  await expect(lastStep(dialog)).toContainText(/approve/i);
  await expect(lastStep(dialog).getByRole('tablist')).toHaveCount(0);
});

test('guides Claude and ChatGPT in tabs, each with a link to its vendor\'s own help, opening on Claude every time and naming no other client', async ({ page, baseURL }) => {
  await signIn(page);
  await openSettings(page);

  const dialog = await openConnectionDialog(startConnectingButton(page));

  await expect(clientTabs(dialog)).toHaveCount(MCP_CLIENTS.length);
  await expectClientShown(dialog, 'Claude');
  const guidance = clientGuidance(dialog);
  await expect(guidance).toHaveCount(1);
  await expect(guidance).toContainText(`${CLAUDE_CODE_COMMAND} ${mcpUrlOf(baseURL)}`);
  await expectHelpLink(guidance, 'Claude');
  await expect(dialog).not.toContainText(OTHER_CLIENTS);

  await clientTab(dialog, 'ChatGPT').click();

  await expectClientShown(dialog, 'ChatGPT');
  await expect(guidance).toHaveCount(1);
  await expect(guidance).toContainText(/developer mode/i);
  await expect(guidance).toContainText('OAuth');
  await expect(guidance).not.toContainText(CLAUDE_CODE_COMMAND);
  await expectHelpLink(guidance, 'ChatGPT');
  await expect(dialog).not.toContainText(OTHER_CLIENTS);

  await closeDialog(dialog);
  await expect(dialog).toBeHidden();
  await openConnectionDialog(startConnectingButton(page));

  await expectClientShown(dialog, 'Claude');
  await expect(guidance).toContainText(CLAUDE_CODE_COMMAND);
  await expect(connectionsSection(page)).not.toContainText(OTHER_CLIENTS);
});

test('moves between the Claude and ChatGPT tabs with the arrow keys', async ({ page }) => {
  await signIn(page);
  await openSettings(page);
  const dialog = await openConnectionDialog(startConnectingButton(page));
  const guidance = clientGuidance(dialog);
  await clientTab(dialog, 'Claude').focus();

  await page.keyboard.press('ArrowRight');

  await expect(clientTab(dialog, 'ChatGPT')).toBeFocused();
  await expectClientShown(dialog, 'ChatGPT');
  await expect(guidance).toContainText('OAuth');

  await page.keyboard.press('ArrowLeft');

  await expect(clientTab(dialog, 'Claude')).toBeFocused();
  await expectClientShown(dialog, 'Claude');
  await expect(guidance).toContainText(CLAUDE_CODE_COMMAND);
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

test('revokes a Connection with `Revoke <client name>`, refusing its Access token and its refresh token on their next use', async ({ page, request, baseURL, client, otherClient }) => {
  await signIn(page);
  const revoked = await connect(page, request, client);
  const kept = await connect(page, request, otherClient);
  expect(await listTools(request, revoked.tokens.accessToken)).not.toEqual([]);
  await page.goto(SETTINGS_PATH);
  await expect(connectionItems(page, client.name)).toHaveCount(1);

  await revokeConnection(connectionItems(page, client.name), client.name);

  await expect(connectionItems(page, client.name)).toHaveCount(0);
  await page.reload();
  await expect(connectionItems(page, otherClient.name)).toHaveCount(1);
  await expect(connectionItems(page, client.name)).toHaveCount(0);
  await expectRevoked(request, revoked, originOf(baseURL));
  expect(await listTools(request, kept.tokens.accessToken)).not.toEqual([]);
});

test('revokes one of two Connections of the same MCP client with `Revoke <client name>`, leaving the other working', async ({ page, request, baseURL, client }) => {
  await signIn(page);
  const kept = await connect(page, request, client, { scopes: ['read'] });
  const revoked = await connect(page, request, client, { scopes: ['read', 'write'] });
  await page.goto(SETTINGS_PATH);
  const items = connectionItems(page, client.name);
  await expect(items).toHaveCount(2);

  await revokeConnection(items.filter({ hasText: SCOPE_SHOWN.write }), client.name);

  await page.reload();
  await expect(connectionItems(page, client.name)).toHaveCount(1);
  await expect(connectionItems(page, client.name)).not.toContainText(SCOPE_SHOWN.write);
  await expectRevoked(request, revoked, originOf(baseURL));
  expect(await listTools(request, kept.tokens.accessToken)).not.toEqual([]);
});

test('opens Revoke connection from `Revoke <client name>`, naming the MCP client and its redirect host, and keeps the Connection when the User backs out', async ({ page, request, client }) => {
  await signIn(page);
  const { tokens } = await connect(page, request, client);
  await page.goto(SETTINGS_PATH);
  const item = connectionItems(page, client.name);

  await revokeConnectionButton(item, client.name).click();
  const dialog = revokeDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(client.name);
  await expect(dialog).toContainText(LOOPBACK_HOST);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(connectionItems(page, client.name)).toHaveCount(1);
  expect(await listTools(request, tokens.accessToken)).not.toEqual([]);
});

for (const language of ['ko', 'ja'] as const) {
  test(`shows the empty state, the connection dialog, the copy feedback and the revoke button's name in ${language}`, async ({ page, request, baseURL, client }) => {
    const letter = LETTER_OF[language];
    await signUpAfterChoosing(page, language);
    const section = await openSettings(page, CATALOGUE[language].connections);
    await expect(documentLanguage(page)).toHaveAttribute('lang', language);
    await grantClipboard(page);

    const opener = section.getByRole('button');
    await expect(opener).toHaveCount(1);
    await expect(opener).toHaveAccessibleName(letter);
    await expect(opener).not.toHaveAccessibleName(ENGLISH_CONTROL_WORDS);
    expect(await explanationBeside(section, opener)).toMatch(letter);

    const dialog = await openConnectionDialog(opener);

    await expect(dialog).toHaveAccessibleName(letter);
    await expect.poll(() => stepCount(dialog)).toBe(3);
    await expect(firstStep(dialog)).toContainText(letter);
    await expect(clientStep(dialog)).toContainText(letter);
    await expect(lastStep(dialog)).toContainText(letter);
    await expect(dialog.getByRole('textbox')).toHaveValue(mcpUrlOf(baseURL));
    const copy = copyButton(dialog);
    await expect(copy).toHaveAccessibleName(letter);
    await expect(copy).not.toHaveAccessibleName(ENGLISH_CONTROL_WORDS);
    const announced = liveRegions(dialog).filter({ hasText: letter });
    await expect(announced).toHaveCount(0);

    await copy.click();

    await expect.poll(() => clipboardText(page)).toBe(mcpUrlOf(baseURL));
    await expect(announced.first()).toBeAttached();
    await expect(announced.first()).not.toContainText(COPIED);
    await expect(copy).not.toHaveAccessibleName(ENGLISH_CONTROL_WORDS);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await connect(page, request, client);
    await openSettings(page, CATALOGUE[language].connections);
    const item = connectionItems(page, client.name);
    await expect(item).toHaveCount(1);
    await expect(item.getByRole('button')).toHaveAccessibleName(new RegExp(escaped(client.name)));
    await expect(item.getByRole('button')).toHaveAccessibleName(letter);
    await expect(revokeConnectionButton(item, client.name)).toHaveCount(0);
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

  test('wraps a long MCP URL within the screen at 390px, showing it whole with no horizontal page scroll', { tag: '@webkit' }, async ({ page }) => {
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
