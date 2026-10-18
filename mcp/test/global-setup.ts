import { fileURLToPath } from 'node:url';
import { createDb } from '@ft/shared/db';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

// Migrations are owned by the api package; apply them to the shared test database.
const migrationsFolder = fileURLToPath(new URL('../../api/migration', import.meta.url));

export default async function setup(): Promise<void> {
  const { db, close } = createDb(process.env.TEST_DATABASE_URL!, { max: 1 });
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}
