import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: '../shared/src/db/schema.ts',
  out: './migration',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
