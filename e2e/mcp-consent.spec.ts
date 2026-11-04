import { type Page } from '@playwright/test';
import { documentLanguage, signUpAfterChoosing } from './language';
import { listTools } from './mcp';
import {
  approveButton,
  approveFor,
  authorizePath,
  clientDocument,
  closedClient,
  codeFrom,
  consentPage,
  denyButton,
  exchangeCode,
  expect,
  expectRefusedWithoutRedirect,
  LOOPBACK_HOST,
  newAuthorization,
  openConsent,
  originOf,
  redirectedTo,
  SCOPE_SHOWN,
  test,
  tokensFrom,
  UNVERIFIED_NAME,
  type Authorization,
  type McpClient,
  type ParamChanges,
} from './oauth';
import { SIGN_IN_URL } from './routes';
import { freshIdentifier, signIn, submitTestSignIn } from './session';

function expectIssuedBy(callback: URL, baseURL: string | undefined): void {
  expect(callback.searchParams.get('iss')).toBe(originOf(baseURL));
}

async function expectRedirectedWithError(
  page: Page,
  authorization: Authorization,
  changes: ParamChanges,
  error: string,
  baseURL: string | undefined,
): Promise<void> {
  await page.goto(authorizePath(authorization, changes));
  const callback = await redirectedTo(page, authorization.redirectUri);
  expect(callback.searchParams.get('error')).toBe(error);
  expect(callback.searchParams.get('state')).toBe(authorization.state);
  expect(callback.searchParams.get('code')).toBeNull();
  expectIssuedBy(callback, baseURL);
}

test('shows the MCP client name as unverified, the host it returns to and what it asks for', async ({ page, baseURL, client }) => {
  await signIn(page);

  await openConsent(page, newAuthorization(client, baseURL));

  const consent = consentPage(page);
  await expect(consent).toContainText(client.name);
  await expect(consent).toContainText(UNVERIFIED_NAME);
  await expect(consent).toContainText(LOOPBACK_HOST);
  await expect(consent.getByRole('listitem').filter({ hasText: SCOPE_SHOWN.read })).toHaveCount(1);
  await expect(consent.getByRole('listitem').filter({ hasText: SCOPE_SHOWN.write })).toHaveCount(1);
  await expect(denyButton(page)).toBeVisible();
});

test('lists only the scopes the MCP client asks for', async ({ page, baseURL, client }) => {
  await signIn(page);

  await openConsent(page, newAuthorization(client, baseURL, { scopes: ['read'] }));

  const consent = consentPage(page);
  await expect(consent.getByRole('listitem').filter({ hasText: SCOPE_SHOWN.read })).toHaveCount(1);
  await expect(consent.getByRole('listitem').filter({ hasText: SCOPE_SHOWN.write })).toHaveCount(0);
});

test('sends the MCP client back with a code, its state and the issuer once the User approves', async ({ page, request, baseURL, client }) => {
  await signIn(page);
  const authorization = newAuthorization(client, baseURL);

  const callback = await approveFor(page, authorization);

  const code = codeFrom(callback, authorization);
  expectIssuedBy(callback, baseURL);
  expect(client.callbacks).toHaveLength(1);
  const tokens = await tokensFrom(await exchangeCode(request, authorization, code));
  expect(tokens.scopes).toEqual(['read', 'write']);
});

test('sends the MCP client back with access_denied and nothing granted once the User denies', async ({ page, baseURL, client }) => {
  await signIn(page);
  const authorization = newAuthorization(client, baseURL);
  await openConsent(page, authorization);

  await denyButton(page).click();

  const callback = await redirectedTo(page, client.redirectUri);
  expect(callback.searchParams.get('error')).toBe('access_denied');
  expect(callback.searchParams.get('state')).toBe(authorization.state);
  expect(callback.searchParams.get('code')).toBeNull();
  expectIssuedBy(callback, baseURL);
});

test('sends a signed-out User through sign-in and back to the same consent', async ({ page, baseURL, client }) => {
  const authorization = newAuthorization(client, baseURL);
  const path = authorizePath(authorization);

  await page.goto(path);
  await expect(page).toHaveURL(SIGN_IN_URL);
  await submitTestSignIn(page, freshIdentifier());

  await expect(approveButton(page)).toBeVisible();
  const returned = new URL(page.url());
  expect(`${returned.pathname}${returned.search}`).toBe(path);
  await expect(consentPage(page)).toContainText(client.name);
});

test('shows the consent page in the User\'s Language', async ({ page, baseURL, client }) => {
  await signUpAfterChoosing(page, 'ko');

  await page.goto(authorizePath(newAuthorization(client, baseURL)));

  await expect(documentLanguage(page)).toHaveAttribute('lang', 'ko');
  const consent = consentPage(page);
  await expect(consent).toContainText(client.name);
  await expect(consent.getByRole('button')).toHaveCount(2);
  await expect(approveButton(page)).toHaveCount(0);
  await expect(denyButton(page)).toHaveCount(0);
  await expect(consent).not.toContainText(SCOPE_SHOWN.read);
});

test('gives each approval of the same MCP client a Connection of its own', async ({ page, request, baseURL, client }) => {
  await signIn(page);
  const first = newAuthorization(client, baseURL);
  const second = newAuthorization(client, baseURL);

  const firstTokens = await tokensFrom(
    await exchangeCode(request, first, codeFrom(await approveFor(page, first), first)),
  );
  const secondTokens = await tokensFrom(
    await exchangeCode(request, second, codeFrom(await approveFor(page, second), second)),
  );

  expect(secondTokens.accessToken).not.toBe(firstTokens.accessToken);
  expect(await listTools(request, firstTokens.accessToken)).not.toEqual([]);
  expect(await listTools(request, secondTokens.accessToken)).not.toEqual([]);
});

test('accepts a loopback redirect on any port when the client document lists it without one', async ({ page, request, baseURL, client }) => {
  client.serve({
    kind: 'document',
    document: clientDocument(client.clientId, client.name, [`http://${LOOPBACK_HOST}/callback`]),
  });
  await signIn(page);
  const authorization = newAuthorization(client, baseURL);

  const callback = await approveFor(page, authorization);

  const tokens = await tokensFrom(
    await exchangeCode(request, authorization, codeFrom(callback, authorization)),
  );
  expect(tokens.accessToken).not.toBe('');
});

test.describe('refuses before asking anything, and redirects nowhere, a request that cannot be trusted', () => {
  async function expectRefused(page: Page, client: McpClient, path: string): Promise<void> {
    await signIn(page);
    await page.goto(path);
    await expectRefusedWithoutRedirect(page, client);
  }

  test('whose client document cannot be reached', async ({ page, baseURL, client }) => {
    const gone = await closedClient();
    const authorization = { ...newAuthorization(client, baseURL), clientId: gone.clientId };

    await expectRefused(page, client, authorizePath(authorization));
  });

  test('whose client document is not JSON', async ({ page, baseURL, client }) => {
    client.serve({ kind: 'raw', status: 200, contentType: 'application/json', body: '{"client_id":' });

    await expectRefused(page, client, authorizePath(newAuthorization(client, baseURL)));
  });

  test('whose client document names another client_id', async ({ page, baseURL, client }) => {
    client.serve({
      kind: 'document',
      document: clientDocument(`${client.origin}/someone-else.json`, client.name, [client.redirectUri]),
    });

    await expectRefused(page, client, authorizePath(newAuthorization(client, baseURL)));
  });

  test('whose redirect the client document does not list', async ({ page, baseURL, client }) => {
    const authorization = newAuthorization(client, baseURL, {
      redirectUri: `${client.origin}/elsewhere`,
    });

    await expectRefused(page, client, authorizePath(authorization));
  });
});

test.describe('refuses before asking anything, and says so to the MCP client, a request', () => {
  test('without a PKCE challenge', async ({ page, baseURL, client }) => {
    await signIn(page);

    await expectRedirectedWithError(
      page,
      newAuthorization(client, baseURL),
      { code_challenge: null, code_challenge_method: null },
      'invalid_request',
      baseURL,
    );
  });

  test('with a plain PKCE challenge', async ({ page, baseURL, client }) => {
    await signIn(page);
    const authorization = newAuthorization(client, baseURL);

    await expectRedirectedWithError(
      page,
      authorization,
      { code_challenge: authorization.pkce.verifier, code_challenge_method: 'plain' },
      'invalid_request',
      baseURL,
    );
  });

  test('for a resource other than this MCP endpoint', async ({ page, baseURL, client }) => {
    await signIn(page);

    await expectRedirectedWithError(
      page,
      newAuthorization(client, baseURL),
      { resource: 'https://mcp.example.com/mcp' },
      'invalid_target',
      baseURL,
    );
  });
});
