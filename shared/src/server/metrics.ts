import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export interface MetricsOptions {
  /** Value of the `service` label added to every metric. */
  service: string;
  /** Registry to use; a fresh one per app keeps tests isolated. */
  registry?: Registry;
}

declare module 'fastify' {
  interface FastifyInstance {
    metrics: Registry;
  }
}

/**
 * Exposes Prometheus metrics on GET /metrics:
 * - Node.js process metrics (CPU, memory, event loop lag, GC)
 * - http_requests_total and http_request_duration_seconds by method / route / status code
 */
const metricsPlugin: FastifyPluginAsync<MetricsOptions> = async (app, opts) => {
  const registry = opts.registry ?? new Registry();
  registry.setDefaultLabels({ service: opts.service });
  collectDefaultMetrics({ register: registry });

  const labelNames = ['method', 'route', 'status_code'] as const;
  const requests = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames,
    registers: [registry],
  });
  const duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  app.decorate('metrics', registry);

  app.addHook('onResponse', async (request, reply) => {
    // Use the route pattern (/accounts/:id), not the raw URL, to keep label cardinality bounded.
    const route = request.routeOptions.url ?? 'unmatched';
    if (route === '/metrics') return;
    const labels = { method: request.method, route, status_code: String(reply.statusCode) };
    requests.inc(labels);
    duration.observe(labels, reply.elapsedTime / 1000);
  });

  app.get('/metrics', { logLevel: 'warn' }, async (_request, reply) => {
    reply.header('content-type', registry.contentType);
    return registry.metrics();
  });
};

export const metrics = fp(metricsPlugin, { name: 'metrics' });
