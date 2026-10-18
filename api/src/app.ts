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
import type { Config } from './config';
import { auth } from './plugins/auth';
import { registerErrorHandler } from './plugins/error-handler';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';
import type { App } from './types';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    dbPool: pg.Pool;
  }
}

export async function buildApp(config: Config): Promise<App> {
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

  return app;
}
