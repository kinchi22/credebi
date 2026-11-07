import {
  type CallToolResult,
  type McpServer,
  type StandardSchemaWithJSON,
  type ToolAnnotations,
} from '@modelcontextprotocol/server';
import { toChart, type DomainError, type Result, type Scope } from '@repo/contracts';
import { type AuthContext, type GetChart } from '@repo/core';
import { z } from 'zod';

export type ToolDependencies = {
  readonly getChart: GetChart;
};

type McpTool = {
  readonly name: string;
  readonly scope: Scope;
  readonly config: {
    readonly description: string;
    readonly inputSchema: StandardSchemaWithJSON;
    readonly annotations: ToolAnnotations;
  };
  readonly run: (auth: AuthContext, dependencies: ToolDependencies) => Promise<CallToolResult>;
};

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
  {
    name: 'list_accounts',
    scope: 'read',
    config: {
      description:
        "Lists the User's Chart of accounts in order: each Account, alone or inside its Account group, with its id, name, description, Account type, group and Active period. Use an Account's id to search or post Entries.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    run: async (auth, { getChart }) =>
      toolResult(await getChart(auth), (chart) => ({ chart: toChart(chart) })),
  },
];

export function scopeGranted(granted: readonly string[] | undefined, scope: Scope): boolean {
  return granted?.includes(scope) === true;
}

export function toolScope(name: string): Scope | undefined {
  return MCP_TOOLS.find((tool) => tool.name === name)?.scope;
}

export function registerTools(
  server: McpServer,
  auth: AuthContext,
  dependencies: ToolDependencies,
): void {
  for (const tool of MCP_TOOLS) {
    if (scopeGranted(auth.scopes, tool.scope)) {
      server.registerTool(tool.name, tool.config, () => tool.run(auth, dependencies));
    }
  }
}
