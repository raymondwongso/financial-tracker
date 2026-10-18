/** Web server configuration, read once from the environment (server-side only). */
export const config = {
  /** Where the Fastify API is reachable from the Next.js server. */
  apiUrl: process.env.API_INTERNAL_URL ?? 'http://localhost:4000',
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
