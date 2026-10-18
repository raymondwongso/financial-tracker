import { ConflictError } from '@ft/shared/db';
import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { HttpError } from '../errors';

/** Maps every error to the shared `ErrorResponse` shape and hides internals on 5xx. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .send({ error: 'NotFound', message: `Route ${request.method} ${request.url} not found` });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Request validation failed',
        issues: error.validation.map((v) => ({
          path: v.instancePath.replace(/^\//, '').replaceAll('/', '.'),
          message: v.message ?? 'Invalid value',
        })),
      });
    }
    if (error instanceof HttpError) {
      if (error.statusCode === 401)
        request.log.warn({ url: request.url }, 'unauthenticated request');
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (error instanceof ConflictError) {
      return reply.status(409).send({ error: 'Conflict', message: error.message });
    }
    if (error.statusCode === 429) {
      return reply
        .status(429)
        .send({ error: 'TooManyRequests', message: 'Too many requests, slow down' });
    }
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply
        .status(error.statusCode)
        .send({ error: error.code ?? 'BadRequest', message: error.message });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply
      .status(500)
      .send({ error: 'InternalServerError', message: 'Something went wrong' });
  });
}
