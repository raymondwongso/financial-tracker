// Applies SQL migrations from api/migration. Usage: `pnpm db:migrate [databaseUrl]`.
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '@ft/shared/db';

export const migrationsFolder = fileURLToPath(new URL('../../migration', import.meta.url));

export async function runMigrations(databaseUrl: string): Promise<void> {
  const { db, close } = createDb(databaseUrl, { max: 1 });
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2] ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  await runMigrations(url);
  console.warn(`Migrations applied to ${new URL(url).pathname.slice(1)}`);
}
