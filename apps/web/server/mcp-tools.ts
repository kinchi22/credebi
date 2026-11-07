import { type CallToolResult, type McpServer } from '@modelcontextprotocol/server';
import { toChart, type DomainError, type Result, type Scope } from '@repo/contracts';
import { type AuthContext, type GetChart } from '@repo/core';
import { z } from 'zod';

export type ToolDependencies = {
  readonly getChart: GetChart;
};

type McpTool = {
  readonly name: string;
  readonly scope: Scope;
  readonly register: (server: McpServer, auth: AuthContext, dependencies: ToolDependencies) => void;
};

export function toolResult<T>(
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
  {
    name: 'list_accounts',
    scope: 'read',
    register: (server, auth, { getChart }) =>
      server.registerTool(
        'list_accounts',
        {
          description:
            "Lists the User's Chart of accounts in order: each Account, alone or inside its Account group, with its id, name, description, Account type, group and Active period. Use an Account's id to search or post Entries.",
          inputSchema: z.object({}),
          annotations: { readOnlyHint: true },
        },
        async () => toolResult(await getChart(auth), (chart) => ({ chart: toChart(chart) })),
      ),
  },
];

export function toolScope(name: string): Scope | undefined {
  return MCP_TOOLS.find((tool) => tool.name === name)?.scope;
}

export function registerTools(
  server: McpServer,
  auth: AuthContext,
  dependencies: ToolDependencies,
): void {
  for (const tool of MCP_TOOLS) {
    if (auth.scopes?.includes(tool.scope) === true) {
      tool.register(server, auth, dependencies);
    }
  }
}
