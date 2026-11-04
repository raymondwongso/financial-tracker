export function pendingMigrations(all: string[], applied: string[]): string[] {
  const done = new Set(applied);
  return all.filter((name) => name.endsWith(".sql") && !done.has(name)).sort();
}
