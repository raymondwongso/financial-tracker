import { z } from 'zod';
import { logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics';

const vitalSchema = z.object({
  name: z.enum(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']),
  value: z.number().nonnegative(),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
});

/** Receives Web Vitals from the browser (see components/web-vitals.tsx). */
export async function POST(request: Request) {
  const parsed = vitalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { name, value, rating } = parsed.data;
  metrics.webVitals.observe({ name, rating }, value);
  metrics.vitalsReports.inc({ name, rating });
  logger.debug({ name, value, rating }, 'web vital');
  return new Response(null, { status: 204 });
}
