#!/usr/bin/env node
// PostToolUse hook: formats and lints the file Claude just wrote. Lint errors are fed back (exit 2).
import { execFileSync } from 'node:child_process';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const FORMATTABLE = /\.(ts|tsx|js|mjs|cjs|json|md|scss|css|ya?ml)$/;
const LINTABLE = /\.(ts|tsx|js|mjs)$/;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let filePath;
  try {
    filePath = JSON.parse(raw).tool_input?.file_path;
  } catch {
    process.exit(0);
  }
  if (!filePath || !filePath.startsWith(projectDir) || /node_modules|\/migration\//.test(filePath))
    process.exit(0);

  const run = (args) =>
    execFileSync('pnpm', ['exec', ...args], { cwd: projectDir, stdio: 'pipe', encoding: 'utf8' });
  try {
    if (FORMATTABLE.test(filePath)) run(['prettier', '--write', '--log-level', 'warn', filePath]);
  } catch {
    // Formatting failures are non-blocking (e.g. syntax error mid-edit).
  }
  if (!LINTABLE.test(filePath)) process.exit(0);
  try {
    run(['eslint', '--no-warn-ignored', filePath]);
  } catch (error) {
    console.error(
      `ESLint found problems in ${filePath}:\n${error.stdout ?? ''}${error.stderr ?? ''}`,
    );
    process.exit(2);
  }
});
