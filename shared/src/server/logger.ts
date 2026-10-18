import type { FastifyServerOptions } from 'fastify';

/** Pino options shared by api and mcp: JSON logs, secrets redacted, pretty output in dev. */
export function loggerOptions(
  service: string,
  level = 'info',
  pretty = false,
): FastifyServerOptions['logger'] {
  return {
    level,
    base: { service },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
      ],
      censor: '[redacted]',
    },
    ...(pretty ? { transport: { target: 'pino-pretty', options: { singleLine: true } } } : {}),
  };
}
