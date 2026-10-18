import type Anthropic from '@anthropic-ai/sdk';
import { signInternalToken } from '@ft/shared/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const TOKEN_TTL_SECONDS = 15 * 60;

export interface McpToolResult {
  /** Human-readable result for the LLM. */
  text: string;
  isError: boolean;
  /** Raw snapshot data (minor units) used to build chat cards. */
  structured?: Record<string, unknown>;
}

export interface McpSession {
  /** MCP tools converted to Claude tool definitions. */
  tools: Anthropic.Tool[];
  callTool(name: string, input: Record<string, unknown>): Promise<McpToolResult>;
  close(): Promise<void>;
}

/** Opens MCP client sessions against our MCP server on behalf of a user. */
export class McpGateway {
  constructor(
    private readonly url: string,
    private readonly secret: string,
  ) {}

  async open(userId: string): Promise<McpSession> {
    // Valid for longer than the longest chat turn (5 LLM calls with 60s timeouts plus retries).
    const token = await signInternalToken(this.secret, userId, TOKEN_TTL_SECONDS);
    const client = new Client({ name: 'financial-tracker-api', version: '0.1.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(this.url), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );

    let tools: Awaited<ReturnType<Client['listTools']>>['tools'];
    try {
      ({ tools } = await client.listTools());
    } catch (error) {
      await client.close();
      throw error;
    }
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description ?? t.title ?? t.name,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
      async callTool(name, input) {
        const result = (await client.callTool({ name, arguments: input })) as CallToolResult;
        const text = result.content
          .map((c) => (c.type === 'text' ? c.text : ''))
          .join('\n')
          .trim();
        return {
          text,
          isError: result.isError === true,
          structured: result.structuredContent as Record<string, unknown> | undefined,
        };
      },
      close: () => client.close(),
    };
  }
}
