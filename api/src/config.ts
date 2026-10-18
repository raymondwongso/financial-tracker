import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    COOKIE_SECURE: z.stringbool().default(false),
    AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
    CHAT_RATE_LIMIT: z.coerce.number().int().positive().default(20),
    MCP_URL: z.url().default('http://localhost:4100/mcp'),
    MCP_INTERNAL_SECRET: z.string().min(32, 'MCP_INTERNAL_SECRET must be at least 32 characters'),
    LLM_PROVIDER: z.enum(['anthropic', 'fake']).default('anthropic'),
    LLM_MODEL: z.string().default('claude-haiku-5-5'),
    ANTHROPIC_API_KEY: z.string().optional(),
  })
  .refine((env) => env.LLM_PROVIDER !== 'anthropic' || !!env.ANTHROPIC_API_KEY, {
    message: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic',
    path: ['ANTHROPIC_API_KEY'],
  });

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid API configuration:\n${details}`);
  }
  return parsed.data;
}
