export function checkBash(command: unknown, options?: { projectDir?: string }): string | null;
export function checkFileWrite(
  filePath: unknown,
  options?: { isTracked?: (p: string) => boolean },
): string | null;
export function countTests(source: unknown): number;
export function checkTestEdit(filePath: unknown, before: unknown, after: unknown): string | null;
