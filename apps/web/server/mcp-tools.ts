import {
  type CallToolResult,
  type McpServer,
  type StandardSchemaWithJSON,
  type ToolAnnotations,
  type ToolCallback,
} from '@modelcontextprotocol/server';
import {
  assetsAndLiabilitiesQuerySchema,
  incomeStatementQuerySchema,
  searchCriteriaSchema,
  toAssetsAndLiabilities,
  toChart,
  toIncomeStatement,
  toPostedEntry,
  type DomainError,
  type Result,
  type Scope,
} from '@repo/contracts';
import {
  type AuthContext,
  type GetAssetsAndLiabilities,
  type GetChart,
  type GetIncomeStatement,
  type SearchEntries,
} from '@repo/core';
import { z } from 'zod';

export const SEARCH_LIMIT = 100;

export type ToolDependencies = {
  readonly getChart: GetChart;
  readonly searchEntries: SearchEntries;
  readonly getAssetsAndLiabilities: GetAssetsAndLiabilities;
  readonly getIncomeStatement: GetIncomeStatement;
};

type McpTool = {
  readonly name: string;
  readonly scope: Scope;
  readonly register: (server: McpServer, auth: AuthContext, dependencies: ToolDependencies) => void;
};

function tool<Input extends StandardSchemaWithJSON>(definition: {
  readonly name: string;
  readonly scope: Scope;
  readonly description: string;
  readonly inputSchema: Input;
  readonly annotations: ToolAnnotations;
  readonly run: (auth: AuthContext, dependencies: ToolDependencies) => ToolCallback<Input>;
}): McpTool {
  const { name, scope, description, inputSchema, annotations, run } = definition;
  return {
    name,
    scope,
    register: (server, auth, dependencies) => {
      server.registerTool(name, { description, inputSchema, annotations }, run(auth, dependencies));
    },
  };
}

function toolResult<T>(
  result: Result<T, DomainError>,
  map: (value: T) => Record<string, unknown>,
): CallToolResult {
  if (!result.ok) {
    return {
      isError: true,
      content: [{ type: 'text', text: `${result.error.code}: ${result.error.message}` }],
    };
  }
  const value = map(result.value);
  return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
}

const MCP_TOOLS: readonly McpTool[] = [
  tool({
    name: 'list_accounts',
    scope: 'read',
    description:
      "Lists the User's Chart of accounts in order: each Account, alone or inside its Account group, with its id, name, description, Account type, group and Active period. Use an Account's id to search or post Entries.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
    run: (auth, { getChart }) => async () =>
      toolResult(await getChart(auth), (chart) => ({ chart: toChart(chart) })),
  }),
  tool({
    name: 'search_entries',
    scope: 'read',
    description: `Searches the User's Entries, most recent first. Every criterion is optional: from and to are calendar days (YYYY-MM-DD) bounding the Entry's day inclusively, account is an Account id from list_accounts, title matches the Title exactly and memo is a substring of the memo. Answers at most ${String(SEARCH_LIMIT)} Entries, each with its lines, total and creation time, and truncated is true when more matched: narrow the range of days to see the rest. Reversals and the Entries they reverse never appear.`,
    inputSchema: searchCriteriaSchema,
    annotations: { readOnlyHint: true },
    run: (auth, { searchEntries }) => async (criteria) =>
      toolResult(await searchEntries(auth, criteria), (entries) => ({
        entries: entries.slice(0, SEARCH_LIMIT).map(toPostedEntry),
        truncated: entries.length > SEARCH_LIMIT,
      })),
  }),
  tool({
    name: 'get_assets_and_liabilities',
    scope: 'read',
    description:
      "Reads the User's Assets and liabilities at the end of a calendar day (YYYY-MM-DD): each section's total and its rows in Chart of accounts order, an Account group with its Accounts, and the net worth. Amounts are in minor units.",
    inputSchema: assetsAndLiabilitiesQuerySchema,
    annotations: { readOnlyHint: true },
    run: (auth, { getAssetsAndLiabilities }) => async ({ date }) =>
      toolResult(await getAssetsAndLiabilities(auth, date), toAssetsAndLiabilities),
  }),
  tool({
    name: 'get_income_statement',
    scope: 'read',
    description:
      "Reads the User's Income statement for an inclusive range of calendar days, from and to (YYYY-MM-DD): revenue and expense, each with its total and its rows in Chart of accounts order, an Account group with its Accounts, and the net income. Amounts are in minor units.",
    inputSchema: incomeStatementQuerySchema,
    annotations: { readOnlyHint: true },
    run: (auth, { getIncomeStatement }) => async (range) =>
      toolResult(await getIncomeStatement(auth, range), toIncomeStatement),
  }),
];

export function scopeGranted(granted: readonly string[] | undefined, scope: Scope): boolean {
  return granted?.includes(scope) === true;
}

export function toolScope(name: string): Scope | undefined {
  return MCP_TOOLS.find((candidate) => candidate.name === name)?.scope;
}

export function registerTools(
  server: McpServer,
  auth: AuthContext,
  dependencies: ToolDependencies,
): void {
  for (const { scope, register } of MCP_TOOLS) {
    if (scopeGranted(auth.scopes, scope)) {
      register(server, auth, dependencies);
    }
  }
}
