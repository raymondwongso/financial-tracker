import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

export const chatRequestSchema = z.object({
  /** Conversation so far, oldest first; the last message must come from the user. */
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(30)
    .refine((m) => m.at(-1)?.role === 'user', 'The last message must be from the user'),
});

export const chatToolCallSchema = z.object({
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
  isError: z.boolean(),
});

export const chatResponseSchema = z.object({
  reply: z.string(),
  toolCalls: z.array(chatToolCallSchema),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatToolCall = z.infer<typeof chatToolCallSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
