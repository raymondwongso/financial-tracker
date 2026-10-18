import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

interface WebMetrics {
  registry: Registry;
  webVitals: Histogram<'name' | 'rating'>;
  vitalsReports: Counter<'name' | 'rating'>;
}

// Kept on globalThis so dev hot reloads don't register metrics twice.
const store = globalThis as typeof globalThis & { __ftWebMetrics?: WebMetrics };

function create(): WebMetrics {
  const registry = new Registry();
  registry.setDefaultLabels({ service: 'web' });
  collectDefaultMetrics({ register: registry });
  return {
    registry,
    webVitals: new Histogram({
      name: 'web_vitals_value',
      help: 'Core Web Vitals reported by browsers (ms, or unitless for CLS)',
      labelNames: ['name', 'rating'],
      buckets: [0.01, 0.05, 0.1, 0.25, 50, 100, 200, 500, 1000, 2500, 4000, 8000],
      registers: [registry],
    }),
    vitalsReports: new Counter({
      name: 'web_vitals_reports_total',
      help: 'Web Vitals reports received',
      labelNames: ['name', 'rating'],
      registers: [registry],
    }),
  };
}

export const metrics = (store.__ftWebMetrics ??= create());
