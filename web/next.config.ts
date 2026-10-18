import path from 'node:path';
import type { NextConfig } from 'next';

const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: trace files from the repository root so @ft/shared is included in the standalone build.
  outputFileTracingRoot: path.join(import.meta.dirname, '..'),
  // Lets the e2e run use its own build directory next to a running dev server.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // @ft/shared is shipped as TypeScript source.
  transpilePackages: ['@ft/shared'],
  serverExternalPackages: ['pino', 'prom-client'],
  poweredByHeader: false,
  sassOptions: {
    // Bootstrap 5.3 still uses @import and legacy color functions; keep build output readable.
    quietDeps: true,
    silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
  },
  async rewrites() {
    // Same-origin API: the browser calls /api/*, so the session cookie stays first-party.
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
