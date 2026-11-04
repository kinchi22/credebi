import { randomBytes, randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type APIResponse, type Locator, type Page } from '@playwright/test';
import { MCP_PATH, PROTECTED_RESOURCE_PATH, recordOf, type Scope } from './oauth';

export const PROTOCOL_VERSION = '2026-07-28';

export const READ_TOOLS = [
  'get_assets_and_liabilities',
  'get_income_statement',
  'list_accounts',
  'search_entries',
] as const;

export const WRITE_TOOLS = ['create_entry'] as const;

export const TOOLS_BY_SCOPE: Readonly<Record<Scope, readonly string[]>> = {
  read: READ_TOOLS,
  write: WRITE_TOOLS,
};

export const SEARCH_LIMIT = 100;

export type McpSide = 'debit' | 'credit';

export type McpLineInput = { readonly account: string; readonly side: McpSide; readonly amount: number };

export type McpEntryInput = {
  readonly entryDate: string;
  readonly title?: string;
  readonly memo?: string;
  readonly lines: readonly McpLineInput[];
  readonly requestKey?: string;
};

export type McpLine = {
  readonly account: string;
  readonly accountName: string;
  readonly side: McpSide;
  readonly amount: number;
};

export type McpEntry = {
  readonly id: string;
  readonly entryDate: string;
  readonly title: string;
  readonly memo: string;
  readonly lines: readonly McpLine[];
  readonly total: number;
  readonly createdAt: string;
};

export type McpAccount = {
  readonly id: string;
  readonly accountType: string;
  readonly groupId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly activeFrom: string;
  readonly activeUntil: string | null;
};

export type McpGroup = {
  readonly id: string;
  readonly accountType: string;
  readonly name: string;
  readonly description: string | null;
};

export type McpChartNode =
  | { readonly kind: 'account'; readonly account: McpAccount }
  | { readonly kind: 'group'; readonly group: McpGroup; readonly accounts: readonly McpAccount[] };

export type McpSearch = { readonly entries: readonly McpEntry[]; readonly truncated: boolean };

export type ToolResult = {
  readonly isError: boolean;
  readonly text: string;
  readonly structured: unknown;
};

export const bearer = (token: string): Readonly<Record<string, string>> => ({
  authorization: `Bearer ${token}`,
});

const envelope = {
  'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
  'io.modelcontextprotocol/clientCapabilities': {},
  'io.modelcontextprotocol/clientInfo': { name: 'credebi-e2e', version: '1.0.0' },
};

export type RpcRequest = {
  readonly id: string;
  readonly method: string;
  readonly params: Readonly<Record<string, unknown>>;
};

export function mcpPost(
  request: APIRequestContext,
  token: string | undefined,
  method: string,
  params: Readonly<Record<string, unknown>> = {},
): Promise<APIResponse> {
  const name = params['name'];
  return request.post(MCP_PATH, {
    headers: {
      ...(token === undefined ? {} : bearer(token)),
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': PROTOCOL_VERSION,
      'mcp-method': method,
      ...(typeof name === 'string' ? { 'mcp-name': name } : {}),
    },
    data: { jsonrpc: '2.0', id: randomUUID(), method, params: { ...params, _meta: envelope } },
  });
}

function messagesIn(body: string, contentType: string): readonly unknown[] {
  if (!contentType.includes('text/event-stream')) return [JSON.parse(body) as unknown];
  return body
    .split(/\r?\n\r?\n/)
    .map((event) =>
      event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trimStart())
        .join('\n'),
    )
    .filter((data) => data !== '')
    .map((data) => JSON.parse(data) as unknown);
}

export async function rpcResult(response: APIResponse): Promise<Readonly<Record<string, unknown>>> {
  const body = await response.text();
  expect(response.status(), body.slice(0, 300)).toBe(200);
  const answer = messagesIn(body, response.headers()['content-type'] ?? '')
    .map((message) => recordOf(message, 'a JSON-RPC message'))
    .find((message) => 'result' in message || 'error' in message);
  expect(answer?.['error'], body.slice(0, 300)).toBeUndefined();
  return recordOf(answer?.['result'], 'the JSON-RPC result');
}

export async function listTools(request: APIRequestContext, token: string): Promise<readonly string[]> {
  const result = await rpcResult(await mcpPost(request, token, 'tools/list'));
  const tools = result['tools'];
  expect(Array.isArray(tools), 'tools/list answers a list of tools').toBe(true);
  return (Array.isArray(tools) ? tools : [])
    .map((tool) => recordOf(tool, 'a tool')['name'])
    .map(String)
    .sort();
}

export const callToolResponse = (
  request: APIRequestContext,
  token: string,
  name: string,
  args: Readonly<Record<string, unknown>>,
): Promise<APIResponse> => mcpPost(request, token, 'tools/call', { name, arguments: args });

export async function callTool(
  request: APIRequestContext,
  token: string,
  name: string,
  args: Readonly<Record<string, unknown>> = {},
): Promise<ToolResult> {
  const result = await rpcResult(await callToolResponse(request, token, name, args));
  const content = result['content'];
  const text = (Array.isArray(content) ? content : [])
    .map((block) => recordOf(block, 'a content block'))
    .filter((block) => block['type'] === 'text')
    .map((block) => String(block['text']))
    .join('\n');
  return { isError: result['isError'] === true, text, structured: result['structuredContent'] };
}

export async function toolValue(
  request: APIRequestContext,
  token: string,
  name: string,
  args: Readonly<Record<string, unknown>> = {},
): Promise<unknown> {
  const result = await callTool(request, token, name, args);
  expect(result.isError, `${name} succeeds: ${result.text}`).toBe(false);
  return result.structured;
}

export function expectToolError(result: ToolResult, code: string): void {
  expect(result.isError, `the call is refused with ${code}`).toBe(true);
  expect(result.text).toMatch(new RegExp(`\\b${code}\\b`));
  expect(result.text.replace(code, '').trim(), 'the refusal carries a message').not.toBe('');
}

export async function toolError(
  request: APIRequestContext,
  token: string,
  name: string,
  args: Readonly<Record<string, unknown>>,
  code: string,
): Promise<ToolResult> {
  const result = await callTool(request, token, name, args);
  expectToolError(result, code);
  return result;
}

export async function expectUnauthorized(response: APIResponse, origin: string): Promise<void> {
  expect(response.status(), (await response.text()).slice(0, 300)).toBe(401);
  const challenge = response.headers()['www-authenticate'] ?? '';
  expect(challenge).toMatch(/^Bearer\b/);
  expect(challenge).toContain(`resource_metadata="${origin}${PROTECTED_RESOURCE_PATH}"`);
}

export async function expectInsufficientScope(response: APIResponse): Promise<void> {
  expect(response.status(), (await response.text()).slice(0, 300)).toBe(403);
  expect(response.headers()['www-authenticate'] ?? '').toContain('error="insufficient_scope"');
}

export async function listAccounts(request: APIRequestContext, token: string): Promise<readonly McpChartNode[]> {
  const value = recordOf(await toolValue(request, token, 'list_accounts'), 'list_accounts');
  const chart = value['chart'];
  expect(Array.isArray(chart), 'list_accounts answers the chart as a list').toBe(true);
  return Array.isArray(chart) ? (chart as readonly McpChartNode[]) : [];
}

export const accountsOf = (chart: readonly McpChartNode[]): readonly McpAccount[] =>
  chart.flatMap((node) => (node.kind === 'account' ? [node.account] : node.accounts));

export async function accountIds(
  request: APIRequestContext,
  token: string,
): Promise<Readonly<Record<string, string>>> {
  return Object.fromEntries(
    accountsOf(await listAccounts(request, token)).map(({ name, id }) => [name, id]),
  );
}

export function idOf(ids: Readonly<Record<string, string>>, name: string): string {
  const id = ids[name];
  expect(id, `the chart holds ${name}`).toBeDefined();
  return id ?? '';
}

export async function searchEntries(
  request: APIRequestContext,
  token: string,
  criteria: Readonly<Record<string, string>>,
): Promise<McpSearch> {
  const value = recordOf(await toolValue(request, token, 'search_entries', criteria), 'search_entries');
  expect(Array.isArray(value['entries']), 'search_entries answers a list of entries').toBe(true);
  expect(typeof value['truncated'], 'search_entries says whether it truncated').toBe('boolean');
  return value as McpSearch;
}

export const createEntry = (
  request: APIRequestContext,
  token: string,
  input: McpEntryInput,
): Promise<ToolResult> => callTool(request, token, 'create_entry', input);

export async function postEntry(
  request: APIRequestContext,
  token: string,
  input: McpEntryInput,
): Promise<McpEntry> {
  const result = await createEntry(request, token, input);
  expect(result.isError, `create_entry succeeds: ${result.text}`).toBe(false);
  return recordOf(result.structured, 'the posted Entry') as McpEntry;
}

export async function expectNothingPosted(
  request: APIRequestContext,
  token: string,
  memo: string,
): Promise<void> {
  expect((await searchEntries(request, token, { memo })).entries).toEqual([]);
}

export const twoLines = (
  debit: string,
  credit: string,
  amount: number,
): readonly McpLineInput[] => [
  { account: debit, side: 'debit', amount },
  { account: credit, side: 'credit', amount },
];

export function uuidV7Like(): string {
  const hex = randomBytes(16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `7${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

const isoDay = (date: Date): string =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');

export const todayCandidates = (): readonly string[] => [
  ...new Set([isoDay(new Date()), new Date().toISOString().slice(0, 10)]),
];

export const shownOnToday = (label: string): RegExp =>
  new RegExp(`${label}\\W*(${todayCandidates().join('|')})`, 'i');

export const connectionsSection = (page: Page): Locator =>
  page.getByRole('region', { name: 'Connections', exact: true });

export const connectionItems = (page: Page, clientName: string): Locator =>
  page.getByRole('listitem').filter({ hasText: clientName });

export const revokeButton = (scope: Locator): Locator =>
  scope.getByRole('button', { name: 'Revoke', exact: true });

export const revokeDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Revoke connection', exact: true });

export async function revokeConnection(item: Locator): Promise<void> {
  await revokeButton(item).click();
  const dialog = revokeDialog(item.page());
  await expect(dialog).toBeVisible();
  await revokeButton(dialog).click();
  await expect(dialog).toBeHidden();
}
