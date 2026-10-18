import {
  accountCreatedDataSchema,
  cardKindByTool,
  monthlySummaryDataSchema,
  transactionRecordedDataSchema,
  transactionsListedDataSchema,
  type ChatCardKind,
} from '@ft/shared';
import type { NewChatCard } from '@ft/shared/db';
import type { z } from 'zod';
import type { McpToolResult } from './mcp-gateway';

const dataSchemas: Record<ChatCardKind, z.ZodType> = {
  account_created: accountCreatedDataSchema,
  transaction_recorded: transactionRecordedDataSchema,
  transactions_listed: transactionsListedDataSchema,
  monthly_summary: monthlySummaryDataSchema,
};

/**
 * Turns a successful MCP tool result into a chat card snapshot. Returns `undefined` for tools
 * that don't produce cards (list_accounts), failed calls, or results that don't match the schema.
 */
export function cardFromToolResult(tool: string, result: McpToolResult): NewChatCard | undefined {
  if (result.isError || !result.structured) return undefined;
  const kind = (cardKindByTool as Record<string, ChatCardKind | undefined>)[tool];
  if (!kind) return undefined;
  const parsed = dataSchemas[kind].safeParse(result.structured);
  return parsed.success ? { kind, data: parsed.data } : undefined;
}
