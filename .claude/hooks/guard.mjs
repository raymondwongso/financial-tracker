#!/usr/bin/env node
// PreToolUse hook: blocks dangerous shell commands, protected file writes and test-weakening edits.
// Exit code 2 blocks the tool call and shows stderr to Claude.
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { checkBash, checkFileWrite, checkTestEdit } from './rules.mjs';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

function isTracked(filePath) {
  try {
    execFileSync(
      'git',
      ['ls-files', '--error-unmatch', relative(projectDir, resolve(projectDir, filePath))],
      {
        cwd: projectDir,
        stdio: 'ignore',
      },
    );
    return true;
  } catch {
    return false;
  }
}

function readCurrent(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function applyEdits(source, edits) {
  return edits.reduce(
    (text, e) =>
      e.replace_all
        ? text.split(e.old_string).join(e.new_string)
        : text.replace(e.old_string, () => e.new_string),
    source,
  );
}

function decide({ tool_name: tool, tool_input: input = {} }) {
  if (tool === 'Bash') return checkBash(input.command, { projectDir });
  if (!['Write', 'Edit', 'MultiEdit'].includes(tool)) return null;

  const filePath = input.file_path;
  const fileReason = checkFileWrite(relative(projectDir, resolve(projectDir, filePath ?? '')), {
    isTracked,
  });
  if (fileReason) return fileReason;

  const before = readCurrent(filePath);
  const after =
    tool === 'Write'
      ? input.content
      : applyEdits(before, tool === 'Edit' ? [input] : (input.edits ?? []));
  return checkTestEdit(filePath, before, after);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const reason = decide(payload);
  if (reason) {
    console.error(`Blocked by .claude/hooks/guard.mjs: ${reason}`);
    process.exit(2);
  }
  process.exit(0);
});
