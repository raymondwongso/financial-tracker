import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { createDb, type Db } from '@ft/shared/db';
import { loggerOptions, metrics } from '@ft/shared/server';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type pg from 'pg';
import { ChatService } from './chat/chat-service';
import { FakeLlm } from './chat/fake-llm';
import { AnthropicLlm, type LlmClient } from './chat/llm';
import { McpGateway } from './chat/mcp-gateway';
import type { Config } from './config';
import { auth } from './plugins/auth';
import { registerErrorHandler } from './plugins/error-handler';
import { accountRoutes } from './routes/accounts';
import { authRoutes } from './routes/auth';
import { chatRoutes } from './routes/chat';
import { healthRoutes } from './routes/health';
import { summaryRoutes } from './routes/summary';
import { transactionRoutes } from './routes/transactions';
import type { App } from './types';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    dbPool: pg.Pool;
  }
}

export interface AppDeps {
  /** Overrides the LLM chosen by LLM_PROVIDER (used by tests to script Claude's responses). */
  llm?: LlmClient;
}

function createLlm(config: Config): LlmClient {
  return config.LLM_PROVIDER === 'fake'
    ? new FakeLlm()
    : new AnthropicLlm(config.ANTHROPIC_API_KEY!, config.LLM_MODEL);
}

export async function buildApp(config: Config, deps: AppDeps = {}): Promise<App> {
  const app = Fastify({
    logger: loggerOptions('api', config.LOG_LEVEL, config.NODE_ENV === 'development'),
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  const { db, pool, close } = createDb(config.DATABASE_URL);
  app.decorate('db', db);
  app.decorate('dbPool', pool);
  app.addHook('onClose', close);

  await app.register(helmet);
  await app.register(rateLimit, { global: false });
  await app.register(metrics, { service: 'api' });
  await app.register(auth, { secret: config.JWT_SECRET, secureCookie: config.COOKIE_SECURE });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/auth', rateLimit: config.AUTH_RATE_LIMIT });
  await app.register(accountRoutes, { prefix: '/accounts' });
  await app.register(transactionRoutes, { prefix: '/transactions' });
  await app.register(summaryRoutes, { prefix: '/summary' });
  await app.register(chatRoutes, {
    prefix: '/chat',
    rateLimit: config.CHAT_RATE_LIMIT,
    chat: new ChatService(
      deps.llm ?? createLlm(config),
      new McpGateway(config.MCP_URL, config.MCP_INTERNAL_SECRET),
    ),
  });

  return app;
}
