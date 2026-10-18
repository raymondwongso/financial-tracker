import pino from 'pino';
import { config } from '@/config';

/** Server-side structured logger for the web app (route handlers, server components). */
export const logger = pino({
  level: config.logLevel,
  base: { service: 'web' },
});
