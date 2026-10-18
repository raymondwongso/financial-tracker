import { defineConfig } from 'vitest/config';

// Set in the main process so both globalSetup and the test workers see it.
process.env.TEST_DATABASE_URL ??=
  'postgres://tracker:tracker@localhost:5432/financial_tracker_test';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
