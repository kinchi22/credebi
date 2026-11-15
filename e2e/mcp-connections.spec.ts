import { dayInBrowser } from './accounts';
import { documentLanguage, signOutIn, signUpAfterChoosing } from './language';
import { listTools } from './mcp';
import {
  connect,
  denyButton,
  expect,
  LOOPBACK_HOST,
  newAuthorization,
  openConsent,
  RAW_SCOPE_NAME,
  redirectedTo,
  SCOPE_SHOWN,
  test,
} from './oauth';
import { SETTINGS_PATH } from './routes';
import { freshIdentifier, signIn } from './session';
import {
  connectionItems,
  connectionsSection,
  revokeButton,
  shownOn,
} from './settings';

test('lists each Connection at `/settings` with its MCP client, redirect host, scopes, creation day and last use', async ({ page, request, client }) => {
  await signIn(page);
  const { tokens } = await connect(page, request, client, { scopes: ['read'] });
  await listTools(request, tokens.accessToken);

  await page.goto(SETTINGS_PATH);

  const today = await dayInBrowser(page);
  const item = connectionsSection(page).getByRole('listitem').filter({ hasText: client.name });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText(LOOPBACK_HOST);
  await expect(item).toContainText(SCOPE_SHOWN.read);
  await expect(item).not.toContainText(SCOPE_SHOWN.write);
  await expect(item).not.toContainText(RAW_SCOPE_NAME);
  await expect(item).toContainText(shownOn('Created', today));
  await expect(item).toContainText(shownOn('Last used', today));
});

test('lists a Connection for each approval, each with the scopes it was granted in words, and none for a denial', async ({ page, request, baseURL, client }) => {
  await signIn(page);
  await connect(page, request, client);
  await connect(page, request, client, { scopes: ['write'] });
  const authorization = newAuthorization(client, baseURL);
  await openConsent(page, authorization);
  await denyButton(page).click();
  await redirectedTo(page, client.redirectUri);

  await page.goto(SETTINGS_PATH);

  const items = connectionsSection(page).getByRole('listitem').filter({ hasText: client.name });
  await expect(items).toHaveCount(2);
  await expect(items.filter({ hasText: SCOPE_SHOWN.read })).toHaveCount(1);
  await expect(items.filter({ hasText: SCOPE_SHOWN.write })).toHaveCount(2);
  await expect(items.filter({ hasText: RAW_SCOPE_NAME })).toHaveCount(0);
});

test('lists the Connections in the User\'s Language', async ({ page, request, client }) => {
  await signUpAfterChoosing(page, 'ko');
  await connect(page, request, client);

  await page.goto(SETTINGS_PATH);

  await expect(documentLanguage(page)).toHaveAttribute('lang', 'ko');
  const item = connectionItems(page, client.name);
  await expect(item).toHaveCount(1);
  await expect(item.getByRole('button')).toHaveCount(1);
  await expect(revokeButton(item)).toHaveCount(0);
  await expect(item).not.toContainText(SCOPE_SHOWN.read);
  await expect(item).not.toContainText(RAW_SCOPE_NAME);
  await expect(connectionsSection(page)).toHaveCount(0);
});

test('leaves the Connections alone when the User signs out of the web app', async ({ page, request, client }) => {
  const identifier = freshIdentifier();
  await signIn(page, { identifier });
  const { tokens } = await connect(page, request, client);
  await page.goto('/entries');

  await signOutIn(page, 'en');

  expect(await listTools(request, tokens.accessToken)).not.toEqual([]);
  await signIn(page, { identifier });
  await page.goto(SETTINGS_PATH);
  await expect(connectionItems(page, client.name)).toHaveCount(1);
});

test('never lists one User\'s Connections to another User', async ({ page, browser, request, client, otherClient }) => {
  await signIn(page);
  await connect(page, request, client);
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await signIn(otherPage);
    await connect(otherPage, request, otherClient);

    await page.goto(SETTINGS_PATH);
    await otherPage.goto(SETTINGS_PATH);

    await expect(connectionItems(page, client.name)).toHaveCount(1);
    await expect(connectionItems(page, otherClient.name)).toHaveCount(0);
    await expect(connectionItems(otherPage, otherClient.name)).toHaveCount(1);
    await expect(connectionItems(otherPage, client.name)).toHaveCount(0);
  } finally {
    await other.close();
  }
});
