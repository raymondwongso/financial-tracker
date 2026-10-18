#!/usr/bin/env node
// Test ratchet: counts test cases per suite and fails if any suite has fewer tests than tests-baseline.json.
// `--update` raises the baseline (never lowers it).
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { countTests } from '../.claude/hooks/rules.mjs';

const root = new URL('..', import.meta.url).pathname;
const baselinePath = join(root, 'tests-baseline.json');
const SUITES = { hooks: '.claude/hooks', shared: 'shared', api: 'api', mcp: 'mcp', web: 'web' };
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  'coverage',
  'test-results',
  'playwright-report',
]);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name)) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : TEST_FILE.test(name) ? [full] : [];
  });
}

const current = Object.fromEntries(
  Object.entries(SUITES).map(([suite, dir]) => [
    suite,
    walk(join(root, dir)).reduce((sum, file) => sum + countTests(readFileSync(file, 'utf8')), 0),
  ]),
);
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};

const regressions = Object.entries(current).filter(
  ([suite, count]) => count < (baseline[suite] ?? 0),
);
for (const [suite, count] of Object.entries(current)) {
  console.log(
    `${suite.padEnd(7)} ${String(count).padStart(4)} tests (baseline ${baseline[suite] ?? 0})`,
  );
}
if (regressions.length > 0) {
  console.error(
    `\nTest count dropped for: ${regressions.map(([s]) => s).join(', ')}. Tests must not be deleted.`,
  );
  process.exit(1);
}
if (process.argv.includes('--update')) {
  const next = Object.fromEntries(
    Object.keys(SUITES).map((s) => [s, Math.max(current[s], baseline[s] ?? 0)]),
  );
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  console.log('\nBaseline updated.');
}
