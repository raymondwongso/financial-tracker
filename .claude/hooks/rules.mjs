// Pure decision functions for the Claude Code hooks. Each returns
// `null` when the action is allowed, or a reason string when it must be blocked.

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

const BASH_RULES = [
  [/\bsudo\b/, 'sudo is not allowed'],
  [
    /\brm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*[rR][a-zA-Z]*[fF]?[a-zA-Z]*\s+(\/|~|\$HOME|\.\.)(\s|\/?$|\/\*)/,
    'recursive rm on /, ~, $HOME or a parent directory',
  ],
  [/\bgit\s+push\b/, 'git push is not allowed; the user pushes manually'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard discards work'],
  [/\bgit\s+clean\s+-[a-zA-Z]*f/, 'git clean -f deletes untracked files'],
  [
    /\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/,
    'discarding all working-tree changes is not allowed',
  ],
  [/\bgit\s+branch\s+-D\b/, 'force-deleting branches is not allowed'],
  [/--no-verify\b/, '--no-verify bypasses safety checks'],
  [/(^|\s)--force(-with-lease)?(\s|$)|\bpush\s+-f\b/, '--force is not allowed'],
  [
    /\bdocker(\s+|-)compose\b[^|;&]*\bdown\b[^|;&]*(-v\b|--volumes\b)/,
    'docker compose down -v deletes database volumes',
  ],
  [
    /\bdocker\s+(volume\s+(rm|prune)|system\s+prune)\b/,
    'deleting docker volumes / pruning is not allowed',
  ],
  [/\b(curl|wget)\b[^|]*\|\s*(ba|z)?sh\b/, 'piping downloads into a shell is not allowed'],
  [/\bchmod\s+(-R\s+)?777\b/, 'chmod 777 is not allowed'],
  [/\bmkfs\b|\bdd\s+if=|>\s*\/dev\/sd/, 'disk-level commands are not allowed'],
  [/\b(npm|pnpm)\s+publish\b/, 'publishing packages is not allowed'],
  [
    /(^|[\s;&|])(cat|less|more|head|tail|bat|source|\.)\s+[^|;&]*\.env(\.(?!example)[\w.-]+)?(\s|$)/,
    'reading .env files is not allowed (secrets)',
  ],
];

const SQL_DESTRUCTIVE = /\b(drop\s+(database|table|schema)|truncate\b)/i;

const RECURSIVE_RM = /\brm\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*\s+([^;&|]+)/g;

export function checkBash(command, { projectDir = process.cwd() } = {}) {
  if (typeof command !== 'string') return null;
  for (const [pattern, reason] of BASH_RULES) {
    if (pattern.test(command)) return reason;
  }
  for (const match of command.matchAll(RECURSIVE_RM)) {
    const targets = match[1]
      .trim()
      .split(/\s+/)
      .filter((t) => !t.startsWith('-'));
    const outside = targets.find((t) => t.startsWith('/') && !t.startsWith(`${projectDir}/`));
    if (outside) return `recursive rm outside the repo (${outside})`;
  }
  // Destructive SQL is only allowed when the command clearly targets the test database.
  if (SQL_DESTRUCTIVE.test(command) && !/financial_tracker_test/.test(command)) {
    return 'DROP/TRUNCATE is only allowed against the financial_tracker_test database';
  }
  // Deleting test files shrinks the test suite.
  if (
    /(^|[\s;&|])(rm|git\s+rm|unlink)\s/.test(command) &&
    /\.(test|spec)\.[cm]?[jt]sx?\b|__tests__|\be2e\//.test(command)
  ) {
    return 'deleting test files is not allowed';
  }
  return null;
}

export function checkFileWrite(filePath, { isTracked = () => false } = {}) {
  if (typeof filePath !== 'string') return null;
  const normalized = filePath.replace(/\\/g, '/');
  const base = normalized.split('/').pop() ?? '';
  if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') {
    return 'writing .env files is not allowed (secrets); edit .env.example instead';
  }
  if (/(^|\/)\.git\//.test(normalized)) return 'writing inside .git is not allowed';
  if (/(^|\/)api\/migration\/.+\.sql$/.test(normalized) && isTracked(normalized)) {
    return 'committed migrations are immutable; generate a new migration instead';
  }
  return null;
}

export function countTests(source) {
  if (typeof source !== 'string') return 0;
  const matches = source.match(/(^|[^\w.])(it|test)(\.each\([^)]*\))?\s*\(/g);
  return matches ? matches.length : 0;
}

const DISABLED_TEST =
  /\b(it|test|describe)\.(skip|only|todo)\b|\b(xit|xdescribe|fit|fdescribe)\s*\(/;

export function checkTestEdit(filePath, before, after) {
  if (typeof filePath !== 'string' || !TEST_FILE.test(filePath)) return null;
  if (DISABLED_TEST.test(after ?? '') && !DISABLED_TEST.test(before ?? '')) {
    return 'adding .skip/.only/.todo/xit to tests is not allowed';
  }
  if (countTests(after) < countTests(before)) {
    return `this edit reduces the number of tests (${countTests(before)} -> ${countTests(after)}); fix the code, not the tests`;
  }
  return null;
}
