import { runMigrations } from '../src/db/migrate';

export default async function setup(): Promise<void> {
  await runMigrations(process.env.TEST_DATABASE_URL!);
}
