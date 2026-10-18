'use client';

import { useReportWebVitals } from 'next/web-vitals';

/** Sends Core Web Vitals to /vitals, which exposes them as Prometheus metrics. */
export function WebVitals() {
  useReportWebVitals((metric) => {
    const body = JSON.stringify({ name: metric.name, value: metric.value, rating: metric.rating });
    if (!navigator.sendBeacon?.('/vitals', new Blob([body], { type: 'application/json' }))) {
      void fetch('/vitals', { method: 'POST', body, keepalive: true });
    }
  });
  return null;
}
