import type { ErrorResponse } from '@ft/shared';

/** Error thrown for non-2xx API responses; carries the shared ErrorResponse fields. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: Partial<ErrorResponse>,
  ) {
    super(body.message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
  }

  /** Field-level validation messages keyed by field path. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.body.issues ?? []).map((i) => [i.path, i.message]));
  }
}

export async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as T & Partial<ErrorResponse>;
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}
