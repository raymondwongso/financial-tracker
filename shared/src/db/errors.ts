/** Raised when a write violates a uniqueness rule (e.g. duplicate email or account name). */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  // Drizzle wraps driver errors; the pg error is either the error itself or its `cause`.
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some(
    (e) =>
      typeof e === 'object' && e !== null && (e as { code?: unknown }).code === UNIQUE_VIOLATION,
  );
}
