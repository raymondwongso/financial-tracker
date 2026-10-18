import pino from 'pino';

/** Server-side structured logger for the web app (route handlers, server components). */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'web' },
});
